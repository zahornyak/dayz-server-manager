import { Manager } from '../control/manager';
import { LogLevel } from '../util/logger';
import * as path from 'path';
import { Paths } from '../services/paths';
import { FileDescriptor } from '../types/log-reader';
import { IService } from '../types/service';
import { LoggerFactory } from './loggerfactory';
import { FSAPI, InjectionTokens } from '../util/apis';
import { inject, injectable, singleton } from 'tsyringe';

@singleton()
@injectable()
export class Backups extends IService {

    public constructor(
        loggerFactory: LoggerFactory,
        private manager: Manager,
        private paths: Paths,
        @inject(InjectionTokens.fs) private fs: FSAPI,
    ) {
        super(loggerFactory.createLogger('Backups'));
    }

    public async createBackup(): Promise<void> {
        try {
            this.log.log(LogLevel.INFO, 'Starting backup creation process');
            const backups = this.getBackupDir();
            
            this.log.log(LogLevel.DEBUG, `Ensuring backup directory exists: ${backups}`);
            await this.fs.promises.mkdir(backups, { recursive: true });
            
            const mpmissions = path.join(this.manager.getServerPath(), 'mpmissions');
            this.log.log(LogLevel.DEBUG, `Source mpmissions path: ${mpmissions}`);
            
            if (!this.fs.existsSync(mpmissions)) {
                this.log.log(LogLevel.WARN, `Skipping backup because mpmissions folder does not exist at path: ${mpmissions}`);
                return;
            }
            
            const now = new Date();
            const curMarker = `mpmissions_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
            
            this.log.log(LogLevel.IMPORTANT, `Creating backup ${curMarker}`);
            
            const curBackup = path.join(backups, curMarker);
            this.log.log(LogLevel.DEBUG, `Destination backup path: ${curBackup}`);
            
            await this.paths.copyDirFromTo(mpmissions, curBackup);
            this.log.log(LogLevel.INFO, `Backup created successfully at: ${curBackup}`);
            
            void this.cleanup();
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to create backup', error);
            throw error;
        }
    }

    public async restoreBackup(backupName: string): Promise<boolean> {
        try {
            this.log.log(LogLevel.INFO, `Starting restore process for backup: ${backupName}`);
            const backupDir = this.getBackupDir();
            const backupPath = path.join(backupDir, backupName);
            
            this.log.log(LogLevel.DEBUG, `Checking if backup exists at path: ${backupPath}`);
            if (!this.fs.existsSync(backupPath)) {
                this.log.log(LogLevel.ERROR, `Backup ${backupName} does not exist at path: ${backupPath}`);
                return false;
            }

            const mpmissionsPath = path.join(this.manager.getServerPath(), 'mpmissions');
            this.log.log(LogLevel.DEBUG, `Target mpmissions path for restore: ${mpmissionsPath}`);
            
            // Create a backup before restoring
            this.log.log(LogLevel.INFO, 'Creating safety backup before restoring');
            await this.createBackup();
            
            // Remove existing mpmissions directory if it exists
            if (this.fs.existsSync(mpmissionsPath)) {
                this.log.log(LogLevel.INFO, `Removing existing mpmissions directory: ${mpmissionsPath}`);
                await this.paths.removeLink(mpmissionsPath);
            }
            
            // Copy the backup to the mpmissions directory
            this.log.log(LogLevel.INFO, `Copying backup from ${backupPath} to ${mpmissionsPath}`);
            await this.paths.copyDirFromTo(backupPath, mpmissionsPath);
            
            this.log.log(LogLevel.IMPORTANT, `Successfully restored backup ${backupName}`);
            return true;
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Failed to restore backup ${backupName}`, error);
            return false;
        }
    }

    private getBackupDir(): string {
        if (this.paths.isAbsolute(this.manager.config.backupPath)) {
            const backupPath = this.manager.config.backupPath;
            this.log.log(LogLevel.DEBUG, `Using absolute backup path: ${backupPath}`);
            return backupPath;
        }
        const backupPath = path.join(this.paths.cwd(), this.manager.config.backupPath);
        this.log.log(LogLevel.DEBUG, `Using relative backup path: ${backupPath}`);
        return backupPath;
    }

    public async getBackups(): Promise<FileDescriptor[]> {
        try {
            this.log.log(LogLevel.INFO, 'Getting list of available backups');
            const backups = this.getBackupDir();
            this.log.log(LogLevel.DEBUG, `Reading backups from directory: ${backups}`);
            
            const files = await this.fs.promises.readdir(backups);
            this.log.log(LogLevel.DEBUG, `Found ${files.length} files in backups directory`);
            
            const foundBackups: FileDescriptor[] = [];
            for (const file of files) {
                const fullPath = path.join(backups, file);
                const stats = await this.fs.promises.stat(fullPath);
                if (file.startsWith('mpmissions_') && stats.isDirectory()) {
                    foundBackups.push({
                        file,
                        mtime: stats.mtime.getTime(),
                    });
                }
            }
            
            this.log.log(LogLevel.INFO, `Found ${foundBackups.length} valid backups`);
            return foundBackups;
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to get backups', error);
            throw error;
        }
    }

    public async cleanup(): Promise<void> {
        try {
            this.log.log(LogLevel.INFO, 'Starting backup cleanup process');
            const now = new Date().valueOf();
            const backups = await this.getBackups();
            const maxAge = this.manager.config.backupMaxAge * 24 * 60 * 60 * 1000;
            
            this.log.log(LogLevel.DEBUG, `Found ${backups.length} backups, checking for expiration (max age: ${this.manager.config.backupMaxAge} days)`);
            
            let removedCount = 0;
            for (const backup of backups) {
                const age = now - backup.mtime;
                if (age > maxAge) {
                    this.log.log(LogLevel.DEBUG, `Removing expired backup: ${backup.file}, age: ${Math.round(age / (24 * 60 * 60 * 1000))} days`);
                    await this.paths.removeLink(backup.file);
                    removedCount++;
                }
            }
            
            this.log.log(LogLevel.INFO, `Backup cleanup complete, removed ${removedCount} expired backups`);
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Error during backup cleanup', error);
        }
    }

}
