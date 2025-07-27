// Simple logger for UI components

// eslint-disable-next-line no-shadow
export enum LogLevel {
    DEBUG = 0,
    INFO,
    IMPORTANT,
    WARN,
    ERROR,
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const LogLevelNames = [
    'DEBUG    ',
    'INFO     ',
    'IMPORTANT',
    'WARN     ',
    'ERROR    ',
];

export class Logger {
    public readonly MAX_CONTEXT_LENGTH = 12;
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private formatContext(context: string): string {
        if (context.length <= this.MAX_CONTEXT_LENGTH) {
            return context.padEnd(this.MAX_CONTEXT_LENGTH, ' ');
        }
        return context.slice(0, this.MAX_CONTEXT_LENGTH);
    }

    public log(level: LogLevel, msg: string, ...data: any[]): void {
        const date = new Date().toISOString();
        const fmt = `@${date} | ${LogLevelNames[level]} | ${this.formatContext(this.context)} | ${msg}`;

        switch (level) {
            case LogLevel.DEBUG:
                console.log(fmt, ...data);
                break;
            case LogLevel.INFO:
                console.log(fmt, ...data);
                break;
            case LogLevel.IMPORTANT:
                console.log(`%c${fmt}`, 'font-weight: bold', ...data);
                break;
            case LogLevel.WARN:
                console.warn(fmt, ...data);
                break;
            case LogLevel.ERROR:
                console.error(fmt, ...data);
                break;
        }
    }
} 