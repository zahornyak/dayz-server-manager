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
    
    public refreshCountries(): void {
        this.refreshStatus = 'Refreshing country data...';
        console.log('*** STARTING COUNTRY REFRESH ***');
        
        // Count players for status update
        const playersCount = this.playerService.getKnownPlayersCount();
        
        // Set timeout to simulate the processing time and update status
        setTimeout(() => {
            console.log(`*** PROCESSING ${playersCount} PLAYERS ***`);
            this.refreshStatus = `Processing ${playersCount} players...`;
        }, 500);
        
        // Call service and handle completion
        this.playerService.refreshCountries().then(updatedCount => {
            console.log(`*** COUNTRY REFRESH COMPLETE: Updated ${updatedCount} players ***`);
            this.refreshStatus = `Success! Updated country data for ${updatedCount} players.`;
            
            // Clear status after a few seconds
            setTimeout(() => {
                this.refreshStatus = '';
            }, 5000);
        }).catch(error => {
            console.error('*** COUNTRY REFRESH ERROR ***', error);
            this.refreshStatus = 'Error refreshing country data. See console for details.';
            
            // Clear status after a few seconds
            setTimeout(() => {
                this.refreshStatus = '';
            }, 5000);
        });
    }
}
