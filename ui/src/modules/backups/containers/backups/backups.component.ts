import { Component, OnInit } from '@angular/core';
import { BackupsService } from '../../services/backups.service';
import { FileDescriptor } from '../../../app-common/models';

@Component({
    selector: 'sb-backups',
    templateUrl: './backups.component.html',
    styleUrls: ['backups.component.scss'],
})
export class BackupsComponent implements OnInit {

    public backups: FileDescriptor[] = [];
    public backupSchedule: { enabled: boolean; cronExpression: string } = { enabled: false, cronExpression: '0 0 * * *' };
    public loading = true;
    public restoring = false;

    public outcomeBadge?: {
        message: string;
        success: boolean;
    };

    public constructor(
        private backupsService: BackupsService,
    ) {}

    public async ngOnInit(): Promise<void> {
        await this.loadBackups();
        await this.loadBackupSchedule();
        this.loading = false;
    }

    public async loadBackups(): Promise<void> {
        try {
            this.backups = await this.backupsService.getBackups();
            this.backups.sort((a, b) => b.mtime - a.mtime);
        } catch (error) {
            console.error('Failed to load backups', error);
            this.outcomeBadge = {
                message: 'Failed to load backups',
                success: false,
            };
        }
    }

    public async loadBackupSchedule(): Promise<void> {
        try {
            this.backupSchedule = await this.backupsService.getBackupSchedule();
        } catch (error) {
            console.error('Failed to load backup schedule', error);
        }
    }

    public async createBackup(): Promise<void> {
        try {
            const success = await this.backupsService.createBackup();
            if (success) {
                this.outcomeBadge = {
                    message: 'Successfully created backup',
                    success: true,
                };
                await this.loadBackups();
            } else {
                this.outcomeBadge = {
                    message: 'Failed to create backup',
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to create backup', error);
            this.outcomeBadge = {
                message: 'Failed to create backup',
                success: false,
            };
        }
    }

    public async restoreBackup(backup: string): Promise<void> {
        if (confirm(`Are you sure you want to restore the backup "${backup}"? This will replace your current mission files.`)) {
            this.restoring = true;
            try {
                const success = await this.backupsService.restoreBackup(backup);
                if (success) {
                    this.outcomeBadge = {
                        message: 'Successfully restored backup',
                        success: true,
                    };
                } else {
                    this.outcomeBadge = {
                        message: 'Failed to restore backup',
                        success: false,
                    };
                }
            } catch (error) {
                console.error('Failed to restore backup', error);
                this.outcomeBadge = {
                    message: 'Failed to restore backup',
                    success: false,
                };
            } finally {
                this.restoring = false;
            }
        }
    }

    public async saveSchedule(): Promise<void> {
        try {
            const success = await this.backupsService.scheduleBackup(this.backupSchedule.cronExpression);
            if (success) {
                this.outcomeBadge = {
                    message: 'Successfully updated backup schedule',
                    success: true,
                };
            } else {
                this.outcomeBadge = {
                    message: 'Failed to update backup schedule',
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to update backup schedule', error);
            this.outcomeBadge = {
                message: 'Failed to update backup schedule',
                success: false,
            };
        }
    }

    public async toggleSchedule(): Promise<void> {
        try {
            const enabled = !this.backupSchedule.enabled;
            const success = await this.backupsService.enableBackupSchedule(enabled);
            if (success) {
                this.backupSchedule.enabled = enabled;
                this.outcomeBadge = {
                    message: `Successfully ${enabled ? 'enabled' : 'disabled'} backup schedule`,
                    success: true,
                };
            } else {
                this.outcomeBadge = {
                    message: `Failed to ${enabled ? 'enable' : 'disable'} backup schedule`,
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to toggle backup schedule', error);
            this.outcomeBadge = {
                message: 'Failed to toggle backup schedule',
                success: false,
            };
        }
    }

    public formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    public getBackupName(file: string): string {
        return file.replace('mpmissions_', '');
    }
} 