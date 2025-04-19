import {
    Component,
    Input,
    OnInit,
} from '@angular/core';
import { SortEvent } from '../../directives/sortable.directive';
import { MergedPlayer, PlayersService } from '../..//services/players.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'sb-player-table',
    templateUrl: './player-table.component.html',
    styleUrls: ['player-table.component.scss'],
})
export class PlayerTableComponent implements OnInit {

    public readonly MAX_ITEMS = 9999999;
    public refreshStatus = '';

    @Input() public players$!: Observable<MergedPlayer[]>;
    @Input() public total$!: Observable<number>;

    public constructor(
        public playerService: PlayersService,
    ) {}

    public ngOnInit(): void {
        // ignore
    }

    public onSort({ column, direction }: SortEvent): void {
        this.playerService.updateState({
            sortColumn: column as keyof MergedPlayer,
            sortDirection: direction,
        });
    }
    
    public refreshCountries(forceUpdate = false): void {
        // Start with a clean status
        this.refreshStatus = forceUpdate 
            ? 'Starting forced country refresh (will override existing values)...'
            : 'Starting country refresh...';
        
        console.log(`*** STARTING COUNTRY REFRESH ${forceUpdate ? '(FORCE MODE)' : ''} ***`);
        
        // Count players for status update
        const playersCount = this.playerService.getKnownPlayersCount();
        
        if (playersCount === 0) {
            this.refreshStatus = 'No players to process';
            return;
        }
        
        // Track progress directly - no need for interval
        let processedCount = 0;
        
        // Call service with progress callback and handle completion
        this.playerService.refreshCountries(
            // Progress callback
            (processed) => {
                // Update our local count
                processedCount = processed;
                
                // Update status message
                const percentage = Math.round((processedCount / playersCount) * 100);
                this.refreshStatus = `Processing ${processedCount} of ${playersCount} players (${percentage}%)...`;
            },
            // Force override flag
            forceUpdate
        )
        .then(updatedCount => {
            // Show success
            console.log(`*** COUNTRY REFRESH COMPLETE: Updated ${updatedCount} players ***`);
            this.refreshStatus = `Success! Updated country data for ${updatedCount} of ${playersCount} players.`;
            
            // Status message stays visible until manually closed
        })
        .catch(error => {
            // Show error
            console.error('*** COUNTRY REFRESH ERROR ***', error);
            this.refreshStatus = `Error refreshing country data: ${error.message || 'Unknown error'}`;
            
            // Status message stays visible until manually closed
        });
    }

    // Test country lookup with different IPs
    public testCountryLookup(): void {
        this.refreshStatus = 'Testing country lookup...';
        
        // Test multiple example IPs
        const testIps = [
            '8.8.8.8',      // Google DNS (US)
            '1.1.1.1',      // Cloudflare (US)
            '94.231.79.10', // Example Russian IP
            '212.77.98.9',  // Vatican City IP
            '185.70.40.31'  // Random European IP
        ];
        
        // Pick a random IP to test
        const testIp = testIps[Math.floor(Math.random() * testIps.length)];
        
        this.playerService.testCountryLookup(testIp)
            .then(country => {
                this.refreshStatus = `Test successful! IP ${testIp} is in country ${country}`;
                console.log(`TEST: Lookup successful for ${testIp} = ${country}`);
                
                // Show all mocked countries
                console.log('TEST: Available mock countries:');
                console.log('- 127.0.0.1: LH (Localhost)');
                console.log('- 192.168.1.1: LN (Local Network)');
                console.log('- 8.8.8.8: US (Google DNS)');
                console.log('- 1.1.1.1: US (Cloudflare)');
                console.log('- 94.231.79.10: RU (Example Russian IP)');
            })
            .catch(error => {
                this.refreshStatus = `Test failed! Error: ${error.message || 'Unknown error'}`;
                console.error('TEST: Lookup failed', error);
            });
    }

    // Update a single player's country data
    public updateSinglePlayerCountry(player: any): void {
        if (!player || !player.ip) {
            this.refreshStatus = 'Error: Player has no IP address';
            return;
        }
        
        this.refreshStatus = `Updating country for player ${player.name || player.beguid}...`;
        console.log(`DIRECT DEBUG: Attempting to update country for player`, player);
        
        // Force a direct country lookup with this player's IP
        this.playerService.testCountryLookup(player.ip)
            .then(country => {
                console.log(`DIRECT DEBUG: Got country ${country} for IP ${player.ip}`);
                
                // Manually set the country
                if (this.playerService.setPlayerCountry(player.beguid, country)) {
                    this.refreshStatus = `Successfully updated player ${player.name || player.beguid} with country ${country}`;
                    console.log(`DIRECT DEBUG: Successfully updated player ${player.name}`);
                } else {
                    this.refreshStatus = `Error: Failed to update player record`;
                    console.error(`DIRECT DEBUG: Failed to update player record`);
                }
            })
            .catch(error => {
                this.refreshStatus = `Error looking up country: ${error.message || 'Unknown error'}`;
                console.error('DIRECT DEBUG: Error in direct country lookup', error);
            });
    }
}
