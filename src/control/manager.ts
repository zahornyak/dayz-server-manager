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
            this.log.log(LogLevel.INFO, `Scheduling backup with cron expression: ${cronExpression}`);
            
            // Set the cron expression in the config
            if (this.config.events) {
                // Look for existing backup event
                const backupEvent = this.config.events.find(e => e.type === 'backup');
                if (backupEvent) {
                    this.log.log(LogLevel.DEBUG, `Found existing backup event with name "${backupEvent.name}", updating cron expression`);
                    backupEvent.cron = cronExpression;
                } else {
                    // Create a new backup event
                    this.log.log(LogLevel.DEBUG, 'No existing backup event found, creating new one');
                    this.config.events.push({
                        name: 'Automated Backup',
                        type: 'backup',
                        cron: cronExpression
                    });
                }
            } else {
                // Initialize events array with backup event
                this.log.log(LogLevel.DEBUG, 'No events array in config, creating new one with backup event');
                this.config.events = [{
                    name: 'Automated Backup',
                    type: 'backup',
                    cron: cronExpression
                }];
            }
            
            this.log.log(LogLevel.INFO, 'Backup schedule successfully updated');
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to schedule backup', error);
            return Promise.resolve(false);
        }
    }

    public getBackupSchedule(): Promise<{ enabled: boolean; cronExpression: string }> {
        try {
            this.log.log(LogLevel.INFO, 'Getting backup schedule');
            
            if (!this.config.events) {
                this.log.log(LogLevel.DEBUG, 'No events array in config, returning default schedule');
                return Promise.resolve({ enabled: false, cronExpression: '0 0 * * *' });
            }

            const backupEvent = this.config.events.find(e => e.type === 'backup');
            if (!backupEvent) {
                this.log.log(LogLevel.DEBUG, 'No backup event found in config, returning default schedule');
                return Promise.resolve({ enabled: false, cronExpression: '0 0 * * *' });
            }

            // To track if it's enabled, we'll check if it has a valid cron expression
            const isEnabled = !!backupEvent.cron;
            
            this.log.log(LogLevel.DEBUG, `Found backup event - name: "${backupEvent.name}", cron: "${backupEvent.cron}", enabled: ${isEnabled}`);
            
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
            this.log.log(LogLevel.INFO, `${enabled ? 'Enabling' : 'Disabling'} backup schedule`);
            
            if (!this.config.events) {
                this.log.log(LogLevel.DEBUG, 'No events array in config, nothing to enable/disable');
                return Promise.resolve(false);
            }

            const backupEvent = this.config.events.find(e => e.type === 'backup');
            if (!backupEvent) {
                this.log.log(LogLevel.DEBUG, 'No backup event found in config, nothing to enable/disable');
                return Promise.resolve(false);
            }

            if (enabled) {
                // If the event doesn't have a cron expression, set a default one
                if (!backupEvent.cron) {
                    this.log.log(LogLevel.DEBUG, 'No cron expression found, setting default value: "0 0 * * *"');
                    backupEvent.cron = '0 0 * * *'; // Midnight every day
                }
            } else {
                // To disable, we remove the event from the events array
                const index = this.config.events.findIndex(e => e.type === 'backup');
                if (index !== -1) {
                    this.log.log(LogLevel.DEBUG, `Removing backup event at index ${index}`);
                    this.config.events.splice(index, 1);
                }
            }
            
            this.log.log(LogLevel.INFO, `Backup schedule successfully ${enabled ? 'enabled' : 'disabled'}`);
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Failed to ${enabled ? 'enable' : 'disable'} backup schedule`, error);
            return Promise.resolve(false);
        }
    }

    // Support for multiple backup schedules
    
    public getBackupSchedules(): Promise<{schedules: Array<{id: string, enabled: boolean, cronExpression: string, description?: string}>}> {
        try {
            this.log.log(LogLevel.INFO, 'Getting all backup schedules');
            
            if (!this.config.events) {
                this.log.log(LogLevel.DEBUG, 'No events array in config, returning empty schedules list');
                return Promise.resolve({ schedules: [] });
            }

            const backupEvents = this.config.events.filter(e => e.type === 'backup');
            
            const schedules = backupEvents.map(event => ({
                // Use stored ID if available, otherwise create one from the name
                id: event.id || event.name.replace(/[^a-zA-Z0-9-_]/g, '_'),
                enabled: !!event.cron, // If it has a cron expression, it's enabled
                cronExpression: event.cron || '',
                description: event.params?.[0] || event.name // Use the first param as description or fallback to name
            }));
            
            this.log.log(LogLevel.DEBUG, `Found ${schedules.length} backup schedules`);
            
            return Promise.resolve({ schedules });
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to get backup schedules', error);
            return Promise.resolve({ schedules: [] });
        }
    }

    public addBackupSchedule(schedule: {enabled: boolean, cronExpression: string, description?: string}): Promise<{id: string, enabled: boolean, cronExpression: string, description?: string}> {
        try {
            this.log.log(LogLevel.INFO, `Adding new backup schedule: ${schedule.description || 'Unnamed'}`);
            
            // Create a new unique name based on description or timestamp
            const baseName = schedule.description 
                ? schedule.description.substring(0, 20) // Limit length
                : 'Backup Schedule';
            
            // Add timestamp to ensure uniqueness
            const timestamp = new Date().getTime().toString().substring(8); // Use last 5 digits
            const name = `${baseName.replace(/[^a-zA-Z0-9-_ ]/g, '_')}_${timestamp}`;
            
            // Generate a unique ID
            const id = `backup_${timestamp}`;
            
            // Initialize events array if it doesn't exist
            if (!this.config.events) {
                this.config.events = [];
            }
            
            // Create the event object
            const newEvent = {
                name,
                type: 'backup' as 'backup',
                cron: schedule.enabled ? schedule.cronExpression : undefined,
                params: schedule.description ? [schedule.description] : undefined,
                id: id // Store the ID explicitly
            };
            
            // Add to the events array
            this.config.events.push(newEvent);
            
            // Save the configuration to file
            this.saveConfig();
            
            this.log.log(LogLevel.INFO, `Successfully added backup schedule with name: ${name} and ID: ${id}`);
            
            return Promise.resolve({
                id: id,
                enabled: schedule.enabled,
                cronExpression: schedule.cronExpression,
                description: schedule.description
            });
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to add backup schedule', error);
            throw error;
        }
    }
    
    // Helper method to save configuration to file
    private saveConfig(): void {
        try {
            // Get the path to the configuration file
            const configPath = require('path').join(process.cwd(), 'server-manager.json');
            
            // Write the configuration to file
            require('fs').writeFileSync(configPath, JSON.stringify(this.config, null, 4));
            
            this.log.log(LogLevel.INFO, 'Configuration saved to file');
        } catch (error) {
            this.log.log(LogLevel.ERROR, 'Failed to save configuration to file', error);
        }
    }

    public updateBackupSchedule(schedule: {id: string, enabled: boolean, cronExpression: string, description?: string}): Promise<boolean> {
        try {
            this.log.log(LogLevel.INFO, `Updating backup schedule with ID: ${schedule.id}`);
            
            if (!this.config.events) {
                this.log.log(LogLevel.ERROR, 'No events array in config, nothing to update');
                return Promise.resolve(false);
            }
            
            // Find the event with matching ID - look for either direct ID or normalized name
            const event = this.config.events.find(e => {
                if (e.type !== 'backup') return false;
                
                // Try direct ID match if available
                if (e.id === schedule.id) return true;
                
                // Try legacy normalized name match
                const normalizedName = e.name.replace(/[^a-zA-Z0-9-_]/g, '_');
                return normalizedName === schedule.id;
            });
            
            if (!event) {
                this.log.log(LogLevel.ERROR, `No backup schedule found with ID: ${schedule.id}`);
                return Promise.resolve(false);
            }
            
            // Update the event
            event.cron = schedule.enabled ? schedule.cronExpression : undefined;
            
            // Store the ID to ensure future lookups work
            event.id = schedule.id;
            
            // Update description if provided
            if (schedule.description !== undefined) {
                if (!event.params) event.params = [];
                event.params[0] = schedule.description;
            }
            
            // Save changes to the config file
            this.saveConfig();
            
            this.log.log(LogLevel.INFO, `Successfully updated backup schedule with ID: ${schedule.id}`);
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Failed to update backup schedule with ID: ${schedule.id}`, error);
            return Promise.resolve(false);
        }
    }

    public deleteBackupSchedule(scheduleId: string): Promise<boolean> {
        try {
            this.log.log(LogLevel.INFO, `Deleting backup schedule with ID: ${scheduleId}`);
            
            if (!this.config.events) {
                this.log.log(LogLevel.ERROR, 'No events array in config, nothing to delete');
                return Promise.resolve(false);
            }
            
            // Find the index of the event - look for either matching ID directly or normalized name
            const eventIndex = this.config.events.findIndex(e => {
                if (e.type !== 'backup') return false;
                
                // Try direct ID match if available
                if (e.id === scheduleId) return true;
                
                // Try legacy normalized name match
                const normalizedName = e.name.replace(/[^a-zA-Z0-9-_]/g, '_');
                return normalizedName === scheduleId;
            });
            
            if (eventIndex === -1) {
                this.log.log(LogLevel.ERROR, `No backup schedule found with ID: ${scheduleId}`);
                return Promise.resolve(false);
            }
            
            // Remove the event
            this.config.events.splice(eventIndex, 1);
            
            // Save changes to the config file
            this.saveConfig();
            
            this.log.log(LogLevel.INFO, `Successfully deleted backup schedule with ID: ${scheduleId}`);
            return Promise.resolve(true);
        } catch (error) {
            this.log.log(LogLevel.ERROR, `Failed to delete backup schedule with ID: ${scheduleId}`, error);
            return Promise.resolve(false);
        }
    }

}
