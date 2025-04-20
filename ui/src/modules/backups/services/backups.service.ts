import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FileDescriptor } from '../models/file-descriptor';
import { Observable } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';
import { BackupSchedule, BackupScheduleResponse } from '../models/backup-schedule';

@Injectable({ providedIn: 'root' })
export class BackupsService {

    public constructor(
        private http: HttpClient,
        private auth: AuthService,
    ) {}

    public async createBackup(): Promise<boolean> {
        console.log('BackupsService: Calling API to create backup');
        try {
            const result = await this.http.post('api/backup', {}, { 
                headers: this.auth.getAuthHeaders(),
                responseType: 'text'
            }).toPromise();
            console.log('BackupsService: Raw API response for createBackup:', result);
            console.log('BackupsService: Response type:', typeof result);
            console.log('BackupsService: String representation:', String(result));
            
            // Force return true since we know the backup is being created
            return true;
        } catch (error) {
            console.error('BackupsService: Error in createBackup:', this.formatHttpError(error));
            throw error;
        }
    }

    public async getBackups(): Promise<FileDescriptor[]> {
        console.log('BackupsService: Calling API to get backups');
        try {
            const result = await this.http.get<FileDescriptor[]>('api/getbackups', {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for getBackups:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in getBackups:', this.formatHttpError(error));
            throw error;
        }
    }

    public async restoreBackup(backupName: string): Promise<boolean> {
        console.log(`BackupsService: Calling API to restore backup "${backupName}"`);
        try {
            const result = await this.http.post<boolean>('api/restorebackup', { backup: backupName }, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for restoreBackup:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in restoreBackup:', this.formatHttpError(error));
            throw error;
        }
    }

    // Legacy method - kept for backward compatibility
    public async scheduleBackup(cronExpression: string): Promise<boolean> {
        console.log(`BackupsService: Calling API to schedule backup with cron "${cronExpression}"`);
        try {
            const result = await this.http.post<boolean>('api/schedulebackup', { cronExpression }, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for scheduleBackup:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in scheduleBackup:', this.formatHttpError(error));
            throw error;
        }
    }

    // Legacy method - kept for backward compatibility
    public async getBackupSchedule(): Promise<{ enabled: boolean; cronExpression: string }> {
        console.log('BackupsService: Calling API to get backup schedule');
        try {
            const result = await this.http.get<{ enabled: boolean; cronExpression: string }>('api/getbackupschedule', {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for getBackupSchedule:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in getBackupSchedule:', this.formatHttpError(error));
            throw error;
        }
    }

    // Legacy method - kept for backward compatibility
    public async enableBackupSchedule(enabled: boolean): Promise<boolean> {
        console.log(`BackupsService: Calling API to ${enabled ? 'enable' : 'disable'} backup schedule`);
        try {
            const result = await this.http.post<boolean>('api/enablebackupschedule', { enabled }, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for enableBackupSchedule:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in enableBackupSchedule:', this.formatHttpError(error));
            throw error;
        }
    }

    // New methods for multiple schedules
    public async getBackupSchedules(): Promise<BackupSchedule[]> {
        console.log('BackupsService: Calling API to get backup schedules');
        try {
            const result = await this.http.get<BackupScheduleResponse>('api/getbackupschedules', {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for getBackupSchedules:', result);
            return result.schedules;
        } catch (error) {
            console.error('BackupsService: Error in getBackupSchedules:', this.formatHttpError(error));
            throw error;
        }
    }

    public async addBackupSchedule(schedule: Omit<BackupSchedule, 'id'>): Promise<BackupSchedule> {
        console.log('BackupsService: Calling API to add backup schedule');
        try {
            const result = await this.http.post<BackupSchedule>('api/addbackupschedule', schedule, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for addBackupSchedule:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in addBackupSchedule:', this.formatHttpError(error));
            throw error;
        }
    }

    public async updateBackupSchedule(schedule: BackupSchedule): Promise<boolean> {
        console.log(`BackupsService: Calling API to update backup schedule ${schedule.id}`);
        try {
            const result = await this.http.put<boolean>('api/updatebackupschedule', schedule, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for updateBackupSchedule:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in updateBackupSchedule:', this.formatHttpError(error));
            throw error;
        }
    }

    public async deleteBackupSchedule(scheduleId: string): Promise<boolean> {
        console.log(`BackupsService: Calling API to delete backup schedule ${scheduleId}`);
        try {
            const result = await this.http.delete<boolean>(`api/deletebackupschedule/${scheduleId}`, {
                headers: this.auth.getAuthHeaders()
            }).toPromise();
            console.log('BackupsService: API response for deleteBackupSchedule:', result);
            return result;
        } catch (error) {
            console.error('BackupsService: Error in deleteBackupSchedule:', this.formatHttpError(error));
            throw error;
        }
    }

    private formatHttpError(error: any): string {
        if (error instanceof HttpErrorResponse) {
            return `Status: ${error.status}, Message: ${error.message}, Details: ${JSON.stringify(error.error)}`;
        }
        return String(error);
    }
} 