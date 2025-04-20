/* tslint:disable: ordered-imports*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

/* Modules */
import { AppCommonModule } from '../app-common/app-common.module';
import { NavigationModule } from '../navigation/navigation.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

/* Components */
import { BackupsComponent } from './containers/backups/backups.component';

/* Services */
import { BackupsService } from './services/backups.service';

/* Models */
// FileDescriptor model is defined locally in models/file-descriptor.ts

@NgModule({
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        FormsModule,
        AppCommonModule,
        NavigationModule,
        FontAwesomeModule,
        NgbModule,
    ],
    providers: [BackupsService],
    declarations: [BackupsComponent],
    exports: [BackupsComponent],
})
export class BackupsModule {} 