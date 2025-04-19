import { Injectable } from '@angular/core';
import { MetricTypeEnum, MetricWrapper, RconPlayer, IngameReportEntry, RconBan } from '../../app-common/models';
import { BehaviorSubject, combineLatest, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { debounceTime, delay, filter, first, map, switchMap, tap } from 'rxjs/operators';
import { SortDirection } from '../directives/sortable.directive';
import { AppCommonService } from 'src/modules/app-common/services/app-common.service';
import sha256 from 'crypto-js/sha256';
import md5 from 'crypto-js/md5';
import WordArray from 'crypto-js/lib-typedarrays';
import Base64 from 'crypto-js/enc-base64';
import bigInt from 'big-integer';

export interface MergedPlayer {
    beguid: string;
    id?: string;
    name?: string;
    ip?: string;
    country?: string;
    port?: string;
    ping?: string;
    lobby?: boolean;

    steamid?: string;
    dayzid?: string;
    ingamename?: string;
    position?: string;
    speed?: string;
    damage?: number;

    banned?: boolean;
    whitelisted?: boolean;
    prio?: boolean;
}

interface SearchResult {
    players: MergedPlayer[];
    total: number;
    allPlayers: MergedPlayer[];
    allTotal: number;
}

interface State {
    page: number;
    pageSize: number;
    searchTerm: string;
    sortColumn: keyof MergedPlayer;
    sortDirection: SortDirection;
}

const compare = (v1: number | string, v2: number | string): -1 | 1 | 0 => {
    return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
};

const sort = (players: MergedPlayer[], column: keyof MergedPlayer, direction: string): MergedPlayer[] => {
    if (direction === '') {
        return players;
    }
    return [...players].sort((a, b) => {
        const res = compare(a[column as string], b[column as string]);
        return direction === 'asc' ? res : -res;
    });
};

const matches = (player: MergedPlayer, term: string): boolean => {
    return (
        !!player.name?.toLowerCase().includes(term.toLowerCase())
        || !!player.ip?.includes(term)
        || player.beguid.includes(term)
        || !!player.steamid?.includes(term)
        || !!player.dayzid?.includes(term)
        || !!player.country?.toLowerCase().includes(term.toLowerCase())
    );
};

@Injectable({ providedIn: 'root' })
export class PlayersService {

    protected knownPlayers = new Map<string, MergedPlayer>();
    protected currentPlayers: MergedPlayer[] = [];

    protected _loading$ = new BehaviorSubject<boolean>(true);
    protected _search$ = new Subject<void>();
    protected _players$ = new BehaviorSubject<MergedPlayer[]>([]);
    protected _total$ = new BehaviorSubject<number>(0);
    protected _allPlayers$ = new BehaviorSubject<MergedPlayer[]>([]);
    protected _allTotal$ = new BehaviorSubject<number>(0);

    protected _selected$ = new BehaviorSubject<MergedPlayer | undefined>(undefined);

    protected _state$ = new BehaviorSubject<State>({
        page: 1,
        pageSize: 4,
        searchTerm: '',
        sortColumn: 'id',
        sortDirection: '',
    });

    public bans = new Set<string>();
    public whitelisted = new Set<string>();
    public priority = new Set<string>();
    public rconBans = new Map<string, RconBan>();

    // Cache for IP to country lookups to minimize API calls
    private countryCache = new Map<string, string>();

    public async loadLists(): Promise<void> {
        this.bans = await this.readBanTxt().toPromise().catch(() => []).then((x) => new Set(x));
        this.whitelisted = await this.readWhitelistTxt().toPromise().catch(() => []).then((x) => new Set(x));
        this.priority = await this.readPriorityTxt().toPromise().catch(() => []).then((x) => new Set(x));
        this.rconBans = await this.readRconBans().toPromise().catch(() => [] as RconBan[]).then((x) => new Map(x.map((y) => [y.id, y])));

        this.knownPlayers.forEach((x) => {
            this.updatePlayerWithIngame({ id2: x.steamid } as any);
        });

        this._search$.next();
    }

    public constructor(
        protected appCommon: AppCommonService,
    ) {
        void this.loadLists();
        void this.listenToPlayerChanges();

        this.state$
            .pipe(
                debounceTime(120)
            )
            .subscribe(() => this._search$.next());

        this._search$
            .pipe(
                tap(() => this._loading$.next(true)),
                debounceTime(120),
                switchMap(() => this._search()),
                tap(() => this._loading$.next(false)),
            )
            .subscribe((result) => {
                this._players$.next(result.players);
                this._total$.next(result.total);
                this._allPlayers$.next(result.allPlayers);
                this._allTotal$.next(result.allTotal);
            });

        this._search$.next();

        // Subscribe to global refresh events and refresh countries
        const originalTriggerUpdate = this.appCommon.triggerUpdate;
        this.appCommon.triggerUpdate = () => {
            originalTriggerUpdate.call(this.appCommon);
            setTimeout(() => this.refreshCountries(), 500); // Delay to allow data to load first
        };
    }

    protected async listenToPlayerChanges(): Promise<void> {
        const [rconPlayers, ingamePlayers] = await Promise.all([
            this.appCommon.getApiFetcher<
                MetricTypeEnum.PLAYERS,
                MetricWrapper<RconPlayer[]>
            >(MetricTypeEnum.PLAYERS).data
                .pipe(
                    filter((x) => !!x?.length),
                    first(),
                )
                .toPromise(),
            this.appCommon.getApiFetcher<
                MetricTypeEnum.INGAME_PLAYERS,
                MetricWrapper<IngameReportEntry[]>
            >(MetricTypeEnum.INGAME_PLAYERS)!.data
                .pipe(
                    filter((x) => !!x?.length),
                    first(),
                )
                .toPromise(),
        ]);

        const uniqueRconPlayers = new Map<string, RconPlayer>();
        rconPlayers?.forEach((x) => x.value?.forEach((y) => uniqueRconPlayers.set(y.beguid, y)));
        uniqueRconPlayers.forEach((x) => this.updatePlayerWithRcon(x));

        const uniqueIngamePlayers = new Map<string, IngameReportEntry>();
        ingamePlayers?.forEach((x) => x.value?.forEach((y) => {
            if (y.id2) uniqueIngamePlayers.set(y.id2!, y);
        }));
        uniqueIngamePlayers.forEach((x) => this.updatePlayerWithIngame(x));

        this._search$.next();

        this.appCommon.getApiFetcher<
            MetricTypeEnum.PLAYERS,
            MetricWrapper<RconPlayer[]>
        >(MetricTypeEnum.PLAYERS)!.latestData.subscribe(
            (data) => {
                if (data?.value) {
                    data.value.forEach((x) => this.updatePlayerWithRcon(x));
                    this.currentPlayers = data.value.map((x) => this.knownPlayers.get(x.beguid)!);
                    this._search$.next();
                }
            }
        );
        this.appCommon.getApiFetcher<
            MetricTypeEnum.INGAME_PLAYERS,
            MetricWrapper<IngameReportEntry[]>
        >(MetricTypeEnum.INGAME_PLAYERS)!.latestData.subscribe(
            (data) => {
                if (data?.value) {
                    data.value.forEach((x) => this.updatePlayerWithIngame(x));
                    this.currentPlayers = data.value
                        .map((x) => this.knownPlayers.get(
                            this.steam64ToBEGUID(x.id2!)
                        )!)
                        .filter((x) => !!x);
                    this._search$.next();
                }
            }
        );
    }

    public get players$(): Observable<MergedPlayer[]> {
        return this._players$.asObservable();
    }

    public get total$(): Observable<number> {
        return this._total$.asObservable();
    }

    public get allPlayers$(): Observable<MergedPlayer[]> {
        return this._allPlayers$.asObservable();
    }

    public get allTotal$(): Observable<number> {
        return this._allTotal$.asObservable();
    }

    public get loading$(): Observable<boolean> {
        return this._loading$.asObservable();
    }

    public get state$(): Observable<State> {
        return this._state$;
    }

    public updateState(patch: Partial<State>): void {
        this._state$.next(Object.assign({}, this._state$.value, patch));
    }

    public get selected$(): Observable<MergedPlayer | undefined> {
        return this._selected$.asObservable();
    }

    public selectPlayer(id: string): void {
        let player: MergedPlayer | undefined = undefined;
        if (id?.length === 17) {
            const beguid = this.steam64ToBEGUID(id);
            player = this.knownPlayers.get(beguid) || {
                beguid,
                steamid: id,
                dayzid: this.steam64ToDayZID(id),
            };
        } else if (id?.length === 44) {
            player = [...this.knownPlayers].find((x) => x[1].dayzid === id)?.[1];
        } else {
            player = this.knownPlayers.get(id);
        }

        this._selected$.next(player);
        this._search$.next();
    }

    private updatePlayerWithRcon(rconPlayer: RconPlayer): MergedPlayer {
        const prevPlayer: MergedPlayer = this.knownPlayers.get(rconPlayer.beguid) || {} as any;
        
        // Get country from IP if available and not already set
        if (rconPlayer.ip && !prevPlayer.country) {
            this.getCountryFromIp(rconPlayer.ip).then(country => {
                const player = this.knownPlayers.get(rconPlayer.beguid);
                if (player) {
                    player.country = country;
                    this.knownPlayers.set(rconPlayer.beguid, player);
                }
            }).catch(error => {
                console.error('Error fetching country from IP:', error);
            });
        }
        
        this.knownPlayers.set(
            rconPlayer.beguid,
            Object.assign(
                {},
                prevPlayer,
                prevPlayer?.steamid ? {
                    ...rconPlayer,
                    banned: this.isBanned(prevPlayer.dayzid || prevPlayer.steamid),
                    whitelisted: this.isWhitelisted(prevPlayer.dayzid || prevPlayer.steamid),
                    prio: this.isPrio(prevPlayer.steamid),
                } : rconPlayer,
            ),
        );
        return this.knownPlayers.get(rconPlayer.beguid)!;
    }

    private updatePlayerWithIngame(ingamePlayer: IngameReportEntry): MergedPlayer {
        const beguid = this.steam64ToBEGUID(ingamePlayer?.id2!);
        if (!beguid) return null!;
        const dayzid = this.steam64ToDayZID(ingamePlayer?.id2!);
        const prevPlayer: MergedPlayer = this.knownPlayers.get(beguid) || { beguid };
        this.knownPlayers.set(
            beguid,
            Object.assign(
                {},
                prevPlayer,
                {
                    beguid,
                    damage: ingamePlayer?.damage ?? prevPlayer.damage,
                    ingamename: ingamePlayer?.name ?? prevPlayer.ingamename,
                    position: ingamePlayer?.position ?? prevPlayer.position,
                    speed: ingamePlayer?.speed?? prevPlayer.speed,
                    steamid: ingamePlayer?.id2 ?? prevPlayer.steamid,
                    dayzid,
                    banned: this.isBanned(dayzid || ingamePlayer.id2),
                    whitelisted: this.isWhitelisted(dayzid || ingamePlayer.id2),
                    prio: this.isPrio(ingamePlayer.id2),
                    country: prevPlayer.country,
                },
            ),
        );
        return this.knownPlayers.get(beguid)!;
    }

    protected _search(): Observable<SearchResult> {
        const { sortColumn, sortDirection, pageSize, page, searchTerm } = this._state$.value;

        const players = sort(this.currentPlayers, sortColumn, sortDirection)
            .filter((x) => matches(x, searchTerm))
            .slice((page - 1) * pageSize, ((page - 1) * pageSize) + pageSize)
        ;
        const allPlayers = sort([...this.knownPlayers.values()], sortColumn, sortDirection)
            .filter((x) => matches(x, searchTerm))
            .slice((page - 1) * pageSize, ((page - 1) * pageSize) + pageSize)
        ;

        return of({ players, total: players.length, allPlayers, allTotal: allPlayers.length });
    }

    public isBanned(steamId?: string): boolean {
        if (!steamId) return false;
        const dayzId = steamId.length === 17 ? this.steam64ToDayZID(steamId) : steamId;
        const beId = steamId.length === 17 ? this.steam64ToBEGUID(steamId) : steamId;
        return this.bans?.has(dayzId) ||this.rconBans?.has(beId);
    }

    public isWhitelisted(steamId?: string): boolean {
        if (!steamId) return false;
        const dayzId = steamId.length === 17 ? this.steam64ToDayZID(steamId) : steamId;
        return this.whitelisted?.has(dayzId);
    }

    public isPrio(steamId?: string): boolean {
        if (steamId?.length !== 17) return false;
        return this.priority?.has(steamId);
    }

    public steam64ToDayZID(steam64Id: string): string {
        if (!steam64Id || steam64Id.length !== 17) return '';
        return sha256(steam64Id)
            .toString(Base64)
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    public steam64ToBEGUID(steam64Id: string): string {
        if (!steam64Id || steam64Id.length !== 17) return '';

        try {
            let steamId = bigInt(steam64Id);
            const parts = [0x42,0x45,0,0,0,0,0,0,0,0];

            for (let i = 2; i < 10; i++) {
                const res = steamId.divmod(256);
                steamId = res.quotient;
                parts[i] = res.remainder.toJSNumber();
            }

            const wordArray = WordArray.create(new Uint8Array(parts) as any);
            const hash = md5(wordArray);
            return hash.toString();
        } catch {
            return '';
        }
    }

    public ban(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `bantxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public unban(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `unbantxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public whitelist(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `whitelisttxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public unwhitelist(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `unwhitelisttxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public prio(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `prioritytxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public unprio(steam64Id: string): Observable<any> {
        return this.appCommon.apiPOST(
            `unprioritytxt`,
            {
                steamid: steam64Id
            }
        );
    }

    public readPriorityTxt(): Observable<string[]> {
        return this.appCommon.apiGET(
            `readprioritytxt`,
        ).pipe(
            map((x) => !!x ? JSON.parse(x) : [])
        );
    }

    public readBanTxt(): Observable<string[]> {
        return this.appCommon.apiGET(
            `readbantxt`,
        ).pipe(
            map((x) => !!x ? JSON.parse(x) : [])
        );
    }

    public readWhitelistTxt(): Observable<string[]> {
        return this.appCommon.apiGET(
            `readwhitelisttxt`,
        ).pipe(
            map((x) => !!x ? JSON.parse(x) : [])
        );
    }

    public readRconBans(): Observable<RconBan[]> {
        return this.appCommon.apiGET(
            `bans`,
        ).pipe(
            tap(x => console.warn(x)),
            map((x) => !!x ? JSON.parse(x) : [])
        );
    }

    public reloadRconBans(): Observable<any> {
        return this.appCommon.apiPOST(
            `reloadbans`,
            {},
        ).pipe(
            tap(x => console.warn(x)),
        );
    }

    // Helper method to get country from IP
    private async getCountryFromIp(ip: string): Promise<string> {
        // Make sure we have a valid IP format - strip port or any extra characters
        const cleanedIp = this.cleanIpAddress(ip);
        if (!cleanedIp) {
            console.error(`[Country] Invalid IP format: ${ip}`);
            return 'Unknown';
        }
        
        // Check cache first
        if (this.countryCache.has(cleanedIp)) {
            console.log(`[Country] Using cached country for IP ${cleanedIp}: ${this.countryCache.get(cleanedIp)}`);
            return this.countryCache.get(cleanedIp)!;
        }

        try {
            console.log(`[Country] Fetching country for IP ${cleanedIp}...`);
            // Using ipapi.co which provides HTTPS
            const response = await fetch(`https://ipapi.co/${cleanedIp}/country/`);
            const data = await response.text();
            console.log(`[Country] API response for IP ${cleanedIp}: "${data}", status: ${response.status}`);
            
            let country = 'Unknown';
            
            if (data && data !== 'Undefined' && response.ok) {
                country = data.trim();
                console.log(`[Country] Successfully found country for IP ${cleanedIp}: ${country}`);
            } else {
                console.warn(`[Country] Failed to get country for IP ${cleanedIp}, response: "${data}", status: ${response.status}`);
                
                // Try with a fallback API if the first one fails
                try {
                    console.log(`[Country] Trying fallback API for IP ${cleanedIp}...`);
                    const fallbackResponse = await fetch(`https://ip-api.com/json/${cleanedIp}?fields=country`);
                    const fallbackData = await fallbackResponse.json();
                    console.log(`[Country] Fallback API response for IP ${cleanedIp}:`, fallbackData);
                    
                    if (fallbackData && fallbackData.status === 'success' && fallbackData.country) {
                        country = fallbackData.country;
                        console.log(`[Country] Successfully found country from fallback API for IP ${cleanedIp}: ${country}`);
                    }
                } catch (fallbackError) {
                    console.error(`[Country] Error using fallback API for IP ${cleanedIp}:`, fallbackError);
                }
            }
            
            // Cache the result
            this.countryCache.set(cleanedIp, country);
            return country;
        } catch (error) {
            console.error(`[Country] Error fetching country for IP ${cleanedIp}:`, error);
            return 'Unknown';
        }
    }

    // Clean IP address to ensure proper format for API calls
    private cleanIpAddress(ip: string): string | null {
        if (!ip) return null;
        
        // Remove port if present (e.g., "127.0.0.1:1234" -> "127.0.0.1")
        const ipParts = ip.split(':');
        const cleanedIp = ipParts[0];
        
        // Validate IP (basic check)
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        if (ipv4Regex.test(cleanedIp)) {
            // Check if the values are in valid range
            const parts = cleanedIp.split('.').map(Number);
            if (parts.every(part => part >= 0 && part <= 255)) {
                return cleanedIp;
            }
        }
        
        // For now, just return the cleaned IP without validation (to support IPv6 too)
        return cleanedIp;
    }

    // Helper method to refresh countries for all players with unknown countries
    public refreshCountries(): void {
        // Refresh countries for players with IP but missing or unknown country
        const allPlayers = [...this.knownPlayers.values()];
        const playersToUpdate = allPlayers.filter(player => 
            player.ip && (!player.country || player.country === 'Unknown')
        );
        
        console.log(`[Country] Total players: ${allPlayers.length}, Players with unknown country: ${playersToUpdate.length}`);
        
        if (playersToUpdate.length === 0) {
            console.log('[Country] No players need country updates');
            return;
        }
        
        console.log(`[Country] Refreshing countries for ${playersToUpdate.length} players:`);
        playersToUpdate.forEach(player => {
            console.log(`[Country] - Player: ${player.name || 'unnamed'}, IP: ${player.ip}, Current country: ${player.country || 'none'}`);
        });
        
        // Update countries
        playersToUpdate.forEach(player => {
            if (player.ip) {
                this.getCountryFromIp(player.ip).then(country => {
                    const playerRecord = this.knownPlayers.get(player.beguid);
                    if (playerRecord) {
                        console.log(`[Country] Updated player ${playerRecord.name || playerRecord.beguid} country from ${playerRecord.country || 'none'} to ${country}`);
                        playerRecord.country = country;
                        this.knownPlayers.set(player.beguid, playerRecord);
                        // Trigger UI update
                        this._search$.next();
                    }
                }).catch(error => {
                    console.error('[Country] Error fetching country from IP:', error);
                });
            }
        });
    }

}
