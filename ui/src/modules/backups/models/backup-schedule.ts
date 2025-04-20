export interface BackupSchedule {
    id: string;
    enabled: boolean;
    cronExpression: string;
    description?: string;
}

export interface BackupScheduleResponse {
    schedules: BackupSchedule[];
} 