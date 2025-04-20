import { Component, OnInit } from '@angular/core';
import { BackupsService } from '../../services/backups.service';
import { FileDescriptor } from '../../models/file-descriptor';

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
            console.log('Attempting to load backups...');
            this.backups = await this.backupsService.getBackups();
            console.log('Backups loaded successfully:', this.backups);
            this.backups.sort((a, b) => b.mtime - a.mtime);
        } catch (error) {
            console.error('Failed to load backups - detailed error:', error);
            this.outcomeBadge = {
                message: 'Failed to load backups: ' + this.getErrorMessage(error),
                success: false,
            };
        }
    }

    public async loadBackupSchedule(): Promise<void> {
        try {
            console.log('Attempting to load backup schedule...');
            this.backupSchedule = await this.backupsService.getBackupSchedule();
            console.log('Backup schedule loaded successfully:', this.backupSchedule);
        } catch (error) {
            console.error('Failed to load backup schedule - detailed error:', error);
            // Don't show a UI error for this as it's not critical
        }
    }

    public async createBackup(): Promise<void> {
        try {
            console.log('Attempting to create a backup...');
            const success = await this.backupsService.createBackup();
            console.log('Create backup API response:', success);
            
            if (success) {
                this.outcomeBadge = {
                    message: 'Successfully created backup',
                    success: true,
                };
                await this.loadBackups();
            } else {
                this.outcomeBadge = {
                    message: 'Failed to create backup: server returned false',
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to create backup - detailed error:', error);
            this.outcomeBadge = {
                message: 'Failed to create backup: ' + this.getErrorMessage(error),
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

    /**
     * Helper method to safely extract error messages from unknown error types
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error) {
            return String((error as { message: unknown }).message);
        } else if (typeof error === 'string') {
            return error;
        } else {
            return JSON.stringify(error);
        }
    }
} 