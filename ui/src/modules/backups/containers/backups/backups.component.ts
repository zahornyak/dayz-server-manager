import { Component, OnInit } from '@angular/core';
import { BackupsService } from '../../services/backups.service';
import { FileDescriptor } from '../../models/file-descriptor';
import { BackupSchedule } from '../../models/backup-schedule';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'sb-backups',
    templateUrl: './backups.component.html',
    styleUrls: ['backups.component.scss'],
})
export class BackupsComponent implements OnInit {

    public backups: FileDescriptor[] = [];
    public backupSchedule: { enabled: boolean; cronExpression: string } = { enabled: false, cronExpression: '0 0 * * *' };
    public backupSchedules: BackupSchedule[] = [];
    public newSchedule: Omit<BackupSchedule, 'id'> = { enabled: true, cronExpression: '0 0 * * *', description: '' };
    public loading = true;
    public restoring = false;
    public editingSchedule: BackupSchedule | null = null;

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
        try {
            await this.loadBackupSchedules();
        } catch (error) {
            console.error('Failed to load backup schedules', error);
            // Fallback to legacy schedule if available
            if (this.backupSchedule.enabled) {
                this.backupSchedules = [{
                    id: 'legacy',
                    enabled: this.backupSchedule.enabled,
                    cronExpression: this.backupSchedule.cronExpression,
                    description: 'Legacy Schedule'
                }];
            }
        }
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

    public async loadBackupSchedules(): Promise<void> {
        try {
            console.log('Attempting to load backup schedules...');
            this.backupSchedules = await this.backupsService.getBackupSchedules();
            console.log('Backup schedules loaded successfully:', this.backupSchedules);
        } catch (error) {
            console.error('Failed to load backup schedules - detailed error:', error);
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

    // New methods for multiple schedules
    public async addSchedule(): Promise<void> {
        try {
            // Try to use the new multi-schedule API
            let addedSchedule: BackupSchedule;
            try {
                addedSchedule = await this.backupsService.addBackupSchedule(this.newSchedule);
            } catch (error) {
                // If we get a 404, the server doesn't support the new API yet
                // Fall back to the legacy API
                console.log('New schedule API not available, falling back to legacy API');
                
                // Use the legacy API to set the schedule
                const success = await this.backupsService.scheduleBackup(this.newSchedule.cronExpression);
                if (!success) {
                    throw new Error('Failed to create schedule using legacy API');
                }
                
                // If enabled is different from current state, toggle it
                if (this.newSchedule.enabled !== this.backupSchedule.enabled) {
                    const toggleSuccess = await this.backupsService.enableBackupSchedule(this.newSchedule.enabled);
                    if (!toggleSuccess) {
                        throw new Error('Failed to enable/disable schedule using legacy API');
                    }
                }
                
                // Create a local fake schedule object since the server doesn't support multiple
                addedSchedule = {
                    id: 'legacy',
                    enabled: this.newSchedule.enabled,
                    cronExpression: this.newSchedule.cronExpression,
                    description: this.newSchedule.description || 'Legacy Schedule'
                };
                
                // Update our local legacy schedule reference
                this.backupSchedule = {
                    enabled: this.newSchedule.enabled,
                    cronExpression: this.newSchedule.cronExpression
                };
                
                // Clear existing schedules since we can only have one with legacy API
                this.backupSchedules = [];
            }
            
            this.backupSchedules.push(addedSchedule);
            this.resetNewSchedule();
            this.outcomeBadge = {
                message: 'Successfully added backup schedule',
                success: true,
            };
        } catch (error) {
            console.error('Failed to add backup schedule', error);
            this.outcomeBadge = {
                message: 'Failed to add backup schedule: ' + this.getErrorMessage(error),
                success: false,
            };
        }
    }

    public async updateSchedule(schedule: BackupSchedule): Promise<void> {
        try {
            const success = await this.backupsService.updateBackupSchedule(schedule);
            if (success) {
                this.editingSchedule = null;
                this.outcomeBadge = {
                    message: 'Successfully updated backup schedule',
                    success: true,
                };
                await this.loadBackupSchedules();
            } else {
                this.outcomeBadge = {
                    message: 'Failed to update backup schedule',
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to update backup schedule', error);
            this.outcomeBadge = {
                message: 'Failed to update backup schedule: ' + this.getErrorMessage(error),
                success: false,
            };
        }
    }

    public async deleteSchedule(scheduleId: string): Promise<void> {
        if (confirm('Are you sure you want to delete this backup schedule?')) {
            try {
                const success = await this.backupsService.deleteBackupSchedule(scheduleId);
                if (success) {
                    this.backupSchedules = this.backupSchedules.filter(s => s.id !== scheduleId);
                    this.outcomeBadge = {
                        message: 'Successfully deleted backup schedule',
                        success: true,
                    };
                } else {
                    this.outcomeBadge = {
                        message: 'Failed to delete backup schedule',
                        success: false,
                    };
                }
            } catch (error) {
                console.error('Failed to delete backup schedule', error);
                this.outcomeBadge = {
                    message: 'Failed to delete backup schedule: ' + this.getErrorMessage(error),
                    success: false,
                };
            }
        }
    }

    public async toggleScheduleEnabled(schedule: BackupSchedule): Promise<void> {
        const updatedSchedule = { ...schedule, enabled: !schedule.enabled };
        try {
            const success = await this.backupsService.updateBackupSchedule(updatedSchedule);
            if (success) {
                const index = this.backupSchedules.findIndex(s => s.id === schedule.id);
                if (index !== -1) {
                    this.backupSchedules[index] = updatedSchedule;
                }
                this.outcomeBadge = {
                    message: `Successfully ${updatedSchedule.enabled ? 'enabled' : 'disabled'} backup schedule`,
                    success: true,
                };
            } else {
                this.outcomeBadge = {
                    message: `Failed to ${updatedSchedule.enabled ? 'enable' : 'disable'} backup schedule`,
                    success: false,
                };
            }
        } catch (error) {
            console.error('Failed to toggle backup schedule', error);
            this.outcomeBadge = {
                message: 'Failed to toggle backup schedule: ' + this.getErrorMessage(error),
                success: false,
            };
        }
    }

    public editSchedule(schedule: BackupSchedule): void {
        this.editingSchedule = { ...schedule };
    }

    public cancelEdit(): void {
        this.editingSchedule = null;
    }

    public resetNewSchedule(): void {
        this.newSchedule = { enabled: true, cronExpression: '0 0 * * *', description: '' };
    }

    public formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    public formatSize(bytes: number | undefined | null): string {
        if (bytes === undefined || bytes === null || bytes === 0) return '0 Bytes';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
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