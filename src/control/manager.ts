import { Config, ServerCfg, UserLevel, WorkshopMod } from '../config/config';
import { Paths } from '../services/paths';
import * as path from 'path';
import { Logger, LogLevel } from '../util/logger';
import { ServerInfo } from '../types/server-info';
import { LoggerFactory } from '../services/loggerfactory';
import { inject, injectable, singleton } from 'tsyringe';
import { FSAPI, InjectionTokens } from '../util/apis';
import { ConfigParser } from '../util/config-parser';

@singleton()
@injectable()
export class Manager {

    public readonly APP_VERSION: string = 'UNKNOWN';

    private log: Logger;

    private config$!: Config;
    public initDone: boolean = false;

    public reloading: boolean = false;
    public reloadWaiting: boolean = false;

    public constructor(
        loggerFactory: LoggerFactory,
        private paths: Paths,
        @inject(InjectionTokens.fs) private fs: FSAPI,
    ) {
        this.log = loggerFactory.createLogger('Manager');
        this.initDone = false;

        const versionFilePath = path.join(__dirname, '../VERSION');
        if (this.fs.existsSync(versionFilePath)) {
            this.APP_VERSION = this.fs.readFileSync(versionFilePath).toString();
        }
        this.log.log(LogLevel.IMPORTANT, `Starting DZSM Version: ${this.APP_VERSION}`);
    }

    public set config(config: Config) {
        this.config$ = config;
    }

    public get config(): Config {
        return this.config$;
    }

    public getServerPath(): string {
        const serverFolder = this.config?.serverPath ?? '';
        if (!serverFolder) {
            return path.join(this.paths.cwd(), 'DayZServer');
        }

        if (!this.paths.isAbsolute(serverFolder)) {
            return path.join(this.paths.cwd(), serverFolder);
        }
        return serverFolder;
    }

    public getServerExePath(): string {
        return path.join(this.getServerPath(), (this.config?.serverExe ?? 'DayZServer_x64.exe'));
    }

    public getProfilesPath(): string {
        const baseDir = this.getServerPath();
        const profiles = this.config.profilesPath;
        if (profiles) {
            if (this.paths.isAbsolute(profiles)) {
                return profiles;
            } else {
                return path.join(baseDir, profiles);
            }
        } else {
            return path.join(baseDir, 'profiles');
        }
    }

    public getUserLevel(userId: string): UserLevel {
        return this.config?.admins?.find((x) => x.userId === userId)?.userLevel ?? null;
    }

    public isUserOfLevel(userId: string, level: UserLevel): boolean {
        if (!level) {
            return true;
        }
        const userLevel = this.getUserLevel(userId);
        if (!userLevel) {
            return false;
        }
        const levels: UserLevel[] = ['admin', 'manage', 'moderate', 'view'];
        return levels.includes(userLevel) && levels.indexOf(userLevel) <= levels.indexOf(level);
    }

    public getWebPort(): number {
        if ((this.config.webPort ?? 0) > 0) {
            return this.config.webPort;
        }
        return this.config.serverPort + 11;
    }

    public async getServerCfg(): Promise<ServerCfg> {
        if (this.config.serverCfg) {
            return this.config.serverCfg;
        }
        const cfgPath = path.join(this.getServerPath(), this.config.serverCfgPath);
        const rawCfg = this.fs.readFileSync(cfgPath) + '';
        return new ConfigParser().cfg2json(rawCfg);
    }

    public async getServerInfo(): Promise<ServerInfo> {
        const serverCfg = await this.getServerCfg();
        return {
            name: serverCfg.hostname,
            port: this.config.serverPort,
            worldName: serverCfg.Missions.DayZ.template.split('.')[1],
            password: !!serverCfg.password,
            battleye: !!serverCfg.BattlEye,
            maxPlayers: serverCfg.maxPlayers,
            mapHost: this.config.mapHost,
        };
    }

    private normalizeModList(mods: (string | WorkshopMod)[]): string[] {
        return (mods ?? [])
            .filter((x) => {
                if (typeof x === 'string') {
                    return !!x;
                }

                return !!x.workshopId && !x.disabled;
            })
            .map((x) => {
                if (typeof x === 'string') {
                    return x;
                }

                return x.workshopId;
            });
    }

    public getModIdList(): string[] {
        return this.normalizeModList(this.config?.steamWsMods ?? []);
    }

    public getServerModIdList(): string[] {
        return this.normalizeModList(this.config?.steamWsServerMods ?? []);
    }

    public getCombinedModIdList(): string[] {
        return this.normalizeModList([
            ...(this.config?.steamWsMods ?? []),
            ...(this.config?.steamWsServerMods ?? []),
        ]);
    }

    public scheduleBackup(cronExpression: string): Promise<boolean> {
        try {
            // Set the cron expression in the config
            if (this.config.events) {
                // Look for existing backup event
                const backupEvent = this.config.events.find(e => e.type === 'backup');
                if (backupEvent) {
                    backupEvent.cron = cronExpression;
                } else {
                    // Create a new backup event
                    this.config.events.push({
                        name: 'Automated Backup',
                        type: 'backup',
                        cron: cronExpression
                    });
                }
            } else {
                // Initialize events array with backup event
                this.config.events = [{
                    name: 'Automated Backup',
                    type: 'backup',
                    cron: cronExpression
                }];
            }
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to schedule backup', error);
            return Promise.resolve(false);
        }
    }

    public getBackupSchedule(): Promise<{ enabled: boolean; cronExpression: string }> {
        try {
            if (!this.config.events) {
                return Promise.resolve({ enabled: false, cronExpression: '0 0 * * *' });
            }

            const backupEvent = this.config.events.find(e => e.type === 'backup');
            if (!backupEvent) {
                return Promise.resolve({ enabled: false, cronExpression: '0 0 * * *' });
            }

            // To track if it's enabled, we'll check if it has a valid cron expression
            const isEnabled = !!backupEvent.cron;
            
            return Promise.resolve({
                enabled: isEnabled,
                cronExpression: backupEvent.cron ?? '0 0 * * *'
            });
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to get backup schedule', error);
            return Promise.resolve({ enabled: false, cronExpression: '0 0 * * *' });
        }
    }

    public enableBackupSchedule(enabled: boolean): Promise<boolean> {
        try {
            if (!this.config.events) {
                return Promise.resolve(false);
            }

            const backupEvent = this.config.events.find(e => e.type === 'backup');
            if (!backupEvent) {
                return Promise.resolve(false);
            }

            if (enabled) {
                // If the event doesn't have a cron expression, set a default one
                if (!backupEvent.cron) {
                    backupEvent.cron = '0 0 * * *'; // Midnight every day
                }
            } else {
                // To disable, we remove the event from the events array
                const index = this.config.events.findIndex(e => e.type === 'backup');
                if (index !== -1) {
                    this.config.events.splice(index, 1);
                }
            }
            
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Failed to ${enabled ? 'enable' : 'disable'} backup schedule`, error);
            return Promise.resolve(false);
        }
    }

}
