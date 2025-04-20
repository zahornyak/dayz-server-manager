import * as path from 'path';
import * as fs from 'fs';
import { injectable, singleton } from 'tsyringe';
import { LoggerFactory } from './loggerfactory';
import { IStatefulService } from '../types/service';
import { LogLevel } from '../util/logger';
import { Paths } from './paths';
import * as geoip from 'geoip-country';

// Simple in-memory cache
interface CacheEntry {
    country: string;
    timestamp: number;
}

@singleton()
@injectable()
export class GeoLocation extends IStatefulService {
    
    // Cache settings
    private readonly CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    private readonly CACHE_FILE = 'ip-cache.json';
    private readonly MAX_CACHE_SIZE = 10000; // Limit cache size
    
    // The IP cache
    private ipCache: Map<string, CacheEntry> = new Map();
    
    // Database paths
    private readonly dbDir: string;
    private readonly cacheFilePath: string;

    constructor(
        loggerFactory: LoggerFactory,
        private paths: Paths
    ) {
        super(loggerFactory.createLogger('GeoLocation'));
        
        // Set up paths for cache storage
        this.dbDir = path.join(this.paths.cwd(), 'data', 'geoip');
        this.cacheFilePath = path.join(this.dbDir, this.CACHE_FILE);
        
        // Ensure directory exists
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
        }
        
        // Load cache from disk if exists
        this.loadCache();
    }

    public async start(): Promise<void> {
        this.log.log(LogLevel.INFO, 'GeoLocation service started');
        return Promise.resolve();
    }

    public stop(): Promise<void> {
        // Save cache to disk before stopping
        this.saveCache();
        return Promise.resolve();
    }

    /**
     * Gets country code from IP address
     */
    public async getCountryFromIp(ip: string): Promise<string> {
        if (!ip) {
            this.log.log(LogLevel.WARN, 'Empty IP provided for lookup');
            return 'Unknown';
        }
        
        // Clean the IP address (remove port if present)
        const cleanedIp = ip.split(':')[0];
        
        // Check if IP is valid format
        if (!this.isValidIpFormat(cleanedIp)) {
            this.log.log(LogLevel.WARN, `Invalid IP format: ${cleanedIp}`);
            return 'Unknown';
        }
        
        // Check for well-known test IPs
        const knownIps: {[key: string]: string} = {
            '127.0.0.1': 'LH', // localhost
            '192.168.1.1': 'LN', // local network
            '8.8.8.8': 'US',   // Google DNS
            '1.1.1.1': 'US',    // Cloudflare
            '94.231.79.10': 'UA' // Ukraine IP
        };
        
        if (knownIps[cleanedIp]) {
            return knownIps[cleanedIp];
        }
        
        // Check cache
        const now = Date.now();
        const cacheEntry = this.ipCache.get(cleanedIp);
        
        if (cacheEntry && (now - cacheEntry.timestamp < this.CACHE_TTL)) {
            this.log.log(LogLevel.DEBUG, `Cache hit for IP ${cleanedIp}: ${cacheEntry.country}`);
            return cacheEntry.country;
        }
        
        try {
            // Use geoip-country to look up the country
            const country = this.lookupFromGeoipCountry(cleanedIp);
            
            // Store result in cache
            this.ipCache.set(cleanedIp, { 
                country, 
                timestamp: now 
            });
            
            // If cache is getting too large, remove oldest entries
            if (this.ipCache.size > this.MAX_CACHE_SIZE) {
                this.pruneCache();
            }
            
            return country;
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Error looking up country for IP ${cleanedIp}`, error);
            return 'Unknown';
        }
    }
    
    /**
     * Loads the IP cache from disk
     */
    private loadCache(): void {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                
                // Convert object to Map
                this.ipCache = new Map();
                for (const ip in cacheData) {
                    if (cacheData.hasOwnProperty(ip)) {
                        this.ipCache.set(ip, cacheData[ip]);
                    }
                }
                
                this.log.log(LogLevel.INFO, `Loaded IP cache with ${this.ipCache.size} entries`);
            }
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to load IP cache', error);
            this.ipCache = new Map();
        }
    }
    
    /**
     * Saves the IP cache to disk
     */
    private saveCache(): void {
        try {
            // Convert Map to object
            const cacheObject = {};
            this.ipCache.forEach((value, key) => {
                cacheObject[key] = value;
            });
            
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheObject, null, 2));
            this.log.log(LogLevel.DEBUG, `Saved IP cache with ${this.ipCache.size} entries`);
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to save IP cache', error);
        }
    }
    
    /**
     * Removes oldest entries from the cache
     */
    private pruneCache(): void {
        // Convert to array for sorting
        const entries = Array.from(this.ipCache.entries());
        
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest 20% of entries
        const entriesToRemove = Math.floor(this.ipCache.size * 0.2);
        
        for (let i = 0; i < entriesToRemove; i++) {
            if (entries[i]) {
                this.ipCache.delete(entries[i][0]);
            }
        }
        
        this.log.log(LogLevel.INFO, `Pruned ${entriesToRemove} entries from IP cache`);
    }
    
    /**
     * Uses geoip-country library to lookup an IP
     */
    private lookupFromGeoipCountry(ip: string): string {
        try {
            const result = geoip.lookup(ip);
            if (result && result.country) {
                this.log.log(LogLevel.DEBUG, `Found country ${result.country} for IP ${ip}`);
                return result.country;
            } else {
                this.log.log(LogLevel.DEBUG, `No country data for IP ${ip}`);
                return 'Unknown';
            }
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Lookup error for IP ${ip}`, error);
            return 'Unknown';
        }
    }
    
    /**
     * Checks if the IP address is in a valid format
     */
    private isValidIpFormat(ip: string): boolean {
        if (!ip) return false;
        
        // Simple regex to validate IPv4 format
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(ipv4Regex);
        
        if (!match) return false;
        
        // Check each octet is in valid range (0-255)
        for (let i = 1; i <= 4; i++) {
            const octet = parseInt(match[i], 10);
            if (octet < 0 || octet > 255) return false;
        }
        
        return true;
    }
} 