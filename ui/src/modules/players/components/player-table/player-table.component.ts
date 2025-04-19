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

    // Test country lookup with a known IP
    public testCountryLookup(): void {
        this.refreshStatus = 'Testing country lookup...';
        
        // Use Google's DNS as a test IP
        const testIp = '8.8.8.8';
        
        this.playerService.testCountryLookup(testIp)
            .then(country => {
                this.refreshStatus = `Test successful! IP ${testIp} is in country ${country}`;
                console.log(`TEST: Lookup successful for ${testIp} = ${country}`);
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
