/* tslint:disable: ordered-imports*/
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

/* Module */
import { BackupsModule } from './backups.module';

import { SBRouteData } from '../navigation/models';
import { BackupsComponent } from './containers/backups/backups.component';

/* Routes */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ROUTES: Routes = [
    {
        path: '',
        canActivate: [],
        component: BackupsComponent,
        data: {
            title: 'Backups',
            breadcrumbs: [
                {
                    text: 'Dashboard',
                    link: '/dashboard',
                },
                {
                    text: 'Backups',
                    active: true,
                },
            ],
        } as SBRouteData,
    },
];

@NgModule({
    imports: [BackupsModule, RouterModule.forChild(ROUTES)],
    exports: [RouterModule],
})
export class BackupsRoutingModule {} 