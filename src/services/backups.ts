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
        const backups = this.getBackupDir();

        await this.fs.promises.mkdir(backups, { recursive: true });

        const mpmissions = path.join(this.manager.getServerPath(), 'mpmissions');
        if (!this.fs.existsSync(mpmissions)) {
            this.log.log(LogLevel.WARN, 'Skipping backup because mpmissions folder does not exist');
            return;
        }

        const now = new Date();
        const curMarker = `mpmissions_${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

        this.log.log(LogLevel.IMPORTANT, `Creating backup ${curMarker}`);

        const curBackup = path.join(backups, curMarker);
        await this.paths.copyDirFromTo(mpmissions, curBackup);

        void this.cleanup();
    }

    public async restoreBackup(backupName: string): Promise<boolean> {
        try {
            const backupDir = this.getBackupDir();
            const backupPath = path.join(backupDir, backupName);
            
            if (!this.fs.existsSync(backupPath)) {
                this.log.log(LogLevel.ERROR, `Backup ${backupName} does not exist`);
                return false;
            }

            const mpmissionsPath = path.join(this.manager.getServerPath(), 'mpmissions');
            
            // Create a backup before restoring
            await this.createBackup();
            
            // Remove existing mpmissions directory if it exists
            if (this.fs.existsSync(mpmissionsPath)) {
                await this.paths.removeLink(mpmissionsPath);
            }
            
            // Copy the backup to the mpmissions directory
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
            return this.manager.config.backupPath;
        }
        return path.join(this.paths.cwd(), this.manager.config.backupPath);
    }

    public async getBackups(): Promise<FileDescriptor[]> {
        const backups = this.getBackupDir();
        const files = await this.fs.promises.readdir(backups);
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
        return foundBackups;
    }

    public async cleanup(): Promise<void> {
        const now = new Date().valueOf();
        const backups = await this.getBackups();
        for (const backup of backups) {
            if ((now - backup.mtime) > (this.manager.config.backupMaxAge * 24 * 60 * 60 * 1000)) {
                await this.paths.removeLink(backup.file);
            }
        }
    }

}
