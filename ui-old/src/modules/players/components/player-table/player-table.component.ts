import {
    Component,
    Input,
    OnInit,
} from '@angular/core';
import { SortEvent } from '../../directives/sortable.directive';
import { MergedPlayer, PlayersService } from '../..//services/players.service';
import { Observable } from 'rxjs';
import { Logger, LogLevel } from 'src/util/logger';

@Component({
    selector: 'sb-player-table',
    templateUrl: './player-table.component.html',
    styleUrls: ['player-table.component.scss'],
})
export class PlayerTableComponent implements OnInit {

    public readonly MAX_ITEMS = 9999999;

    @Input() public players$!: Observable<MergedPlayer[]>;
    @Input() public total$!: Observable<number>;
    
    // Logger instance
    private log: Logger = new Logger('PlayerTableComponent');

    public constructor(
        public playerService: PlayersService,
    ) {}

    public ngOnInit(): void {
        // Add a test log to verify logging works
        this.log.log(LogLevel.IMPORTANT, 'PLAYER TABLE COMPONENT INITIALIZED');
        
        // Refresh countries for any existing players on component init
        setTimeout(() => {
            this.log.log(LogLevel.INFO, 'Triggering country refresh');
            this.refreshCountries();
        }, 1000);
    }

    public onSort({ column, direction }: SortEvent): void {
        this.playerService.updateState({
            sortColumn: column as keyof MergedPlayer,
            sortDirection: direction,
        });
    }
    
    public refreshCountries(): void {
        console.log('DIRECT: Player table - refreshCountries button clicked');
        // Direct method to test if API calls are working
        const testIp = '94.231.79.10';
        
        // Call our service to refresh countries
        this.playerService.refreshCountries();
        
        // Alert user that refresh has started
        alert(`Refreshing countries for players. Check the console for details.`);
    }
}
