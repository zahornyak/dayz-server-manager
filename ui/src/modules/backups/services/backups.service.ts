import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FileDescriptor } from '../models/file-descriptor';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BackupsService {

    public constructor(
        private http: HttpClient,
    ) {}

    public async createBackup(): Promise<boolean> {
        return this.http.post<boolean>('api/backup', {}).toPromise();
    }

    public async getBackups(): Promise<FileDescriptor[]> {
        return this.http.get<FileDescriptor[]>('api/getbackups').toPromise();
    }

    public async restoreBackup(backupName: string): Promise<boolean> {
        return this.http.post<boolean>('api/restorebackup', { backup: backupName }).toPromise();
    }

    public async scheduleBackup(cronExpression: string): Promise<boolean> {
        return this.http.post<boolean>('api/schedulebackup', { cronExpression }).toPromise();
    }

    public async getBackupSchedule(): Promise<{ enabled: boolean; cronExpression: string }> {
        return this.http.get<{ enabled: boolean; cronExpression: string }>('api/getbackupschedule').toPromise();
    }

    public async enableBackupSchedule(enabled: boolean): Promise<boolean> {
        return this.http.post<boolean>('api/enablebackupschedule', { enabled }).toPromise();
    }
} 