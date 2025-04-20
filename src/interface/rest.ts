import * as express from 'express';
import * as ws from 'ws';
import * as basicAuth from 'express-basic-auth';
import * as compression from 'compression';
import * as path from 'path';
import { loggerMiddleware } from '../middleware/logger';

import { Manager } from '../control/manager';
import { Server } from 'http';
import { Request, Response, ResponsePart } from '../types/interface';
import { LogLevel } from '../util/logger';
import { IStatefulService } from '../types/service';
import { LoggerFactory } from '../services/loggerfactory';
import { injectable, singleton } from 'tsyringe';
import { EventBus } from '../control/event-bus';
import { InternalEventTypes } from '../types/events';
import { Listener } from 'eventemitter2';
import { WebsocketCommand, WebsocketListenerEvent, WebsocketListenerType, WebsocketMessage } from '../types/websocket';
import { Interface } from './interface';
import { GeoLocation } from '../services/geolocation';
import { container } from 'tsyringe';

@singleton()
@injectable()
export class REST extends IStatefulService {

    public express: express.Application | undefined;
    public server: Server | undefined;
    public wsServer: ws.Server | undefined;
    public wsClients: Map<ws, { user: string, listeners: Listener[]}> | undefined;

    public host: string | undefined;
    public port: number | undefined;

    public path = '/';
    public router = express.Router();

    private readonly UI_FILES = path.join(__dirname, '../ui');

    public constructor(
        loggerFactory: LoggerFactory,
        private manager: Manager,
        private eventBus: EventBus,
        private eventInterface: Interface,
    ) {
        super(loggerFactory.createLogger('REST'));
    }

    /* istanbul ignore next function for easier tests */
    public createExpress(): express.Application {
        return (express as any)();
    }

    public async start(): Promise<void> {
        this.express = this.createExpress();

        this.port = this.manager.getWebPort();
        this.host = this.manager.config.publishWebServer ? '0.0.0.0' : '127.0.0.1';

        // middlewares
        this.express.use((compression as any)());
        this.express.use(express.json({ limit: '50mb' }));
        this.express.use(express.urlencoded({ extended: true }));
        this.express.use(loggerMiddleware);

        // static content
        this.express.use(express.static(this.UI_FILES));

        this.setupExpress();

        // controllers
        this.express.get(
            '/version',
            /* istanbul ignore next */
            (req, res) => res.send(this.manager.APP_VERSION),
        );
        this.express.use(
            '/api',
            this.router,
        );
        await this.setupRouter();

        // Set up a headless websocket server that prints any
        // events that come in.
        this.wsClients = new Map();
        this.wsServer = new ws.Server({ noServer: true, path: '/websocket' });
        this.wsServer.on('connection', (socket: any) => {
            socket.on('message', (message) => this.handleWsMessage(socket, message));
            socket.on('close', () => {
                const socketData = (this.wsClients?.get(socket)?.listeners || []);
                this.wsClients?.delete(socket);
                for (const listener of socketData) {
                    listener.off();
                }
            });
        });

        return new Promise(
            (r) => {
                this.server = this.express!.listen(
                    this.port,
                    this.host,
                    () => {
                        this.log.log(LogLevel.IMPORTANT, `App listening on the http://${this.host}:${this.port}`);
                        r();
                    },
                );
                this.server.on('upgrade', (request, socket, head) => {
                    const url = new URL(request.url, `http://${request.headers.host}`);

                    if (url.pathname !== '/websocket') {
                        socket.write('HTTP/1.1 404 NotFound\r\n\r\n');
                        socket.destroy();
                        return;
                    }

                    const base64Credentials = request.headers['sec-websocket-protocol']?.split(',')[1]?.trim();
                    const [username, password] = base64Credentials
                        ? Buffer.from(decodeURIComponent(base64Credentials), 'base64')?.toString('utf-8')?.split(':')
                        : [];

                    if (!username || !password || !(this.manager.config?.admins ?? []).some((x) => x.userId === username && x.password === password)) {
                        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                        socket.destroy();
                        return;
                    }

                    this.log.log(LogLevel.INFO, `Websocket Connection for ${username}`);
                    this.wsServer.handleUpgrade(request, socket as any, head, (wsSocket: any) => {
                        this.wsClients.set(
                            wsSocket,
                            {
                                user: username,
                                listeners: this.wsClients.get(wsSocket)?.listeners || [],
                            },
                        );
                        this.wsServer.emit('connection', wsSocket, request);
                    });
                });
            },
        );

    }

    private registerWsEventListener(socket: ws, listenerType: WebsocketListenerType): void {
        const cmd = this.eventInterface.commandMap.get(listenerType);
        if (!cmd) {
            this.log.log(LogLevel.INFO, 'Listener type is not mapped to a command', listenerType);
            return;
        }

        const user = this.wsClients.get(socket)?.user;
        if (!user || !this.manager.isUserOfLevel(user, cmd.level)) {
            this.log.log(LogLevel.INFO, `User "${user}" is not allowed to listen on ${listenerType}. Required level: ${cmd.level}`);
            return;
        }

        let eventType: InternalEventTypes;
        if (listenerType === WebsocketListenerType.LOGS) {
            eventType = InternalEventTypes.LOG_ENTRY;
        } else if (listenerType === WebsocketListenerType.METRICS) {
            eventType = InternalEventTypes.METRIC_ENTRY;
        } else {
            this.log.log(LogLevel.INFO, 'Received unknown websocket listener type', listenerType);
            return;
        }

        this.log.log(LogLevel.DEBUG, `Registering: ${listenerType} for ${user}`);
        const listener = this.eventBus.on(
            eventType as any,
            async (event) => {
                socket.send(JSON.stringify({
                    cmd: WebsocketCommand.LISTENER_EVENT,
                    data: {
                        type: listenerType,
                        event: event,
                    },
                } as WebsocketMessage<WebsocketListenerEvent>));
            },
        );
        const socketDetails = this.wsClients.get(socket);
        if (!socketDetails.listeners) {
            socketDetails.listeners = [];
        }
        socketDetails.listeners.push(listener);
    }

    private handleWsMessage(socket: ws, message: ws.Data): void {
        const str = typeof message === 'string' ? message : message?.toString();
        try {
            const data = JSON.parse(str) as WebsocketMessage<any>;
            if (data?.cmd === WebsocketCommand.REGISTER_LISTENER) {
                this.log.log(LogLevel.DEBUG, 'Received register websocket listener', str);
                this.registerWsEventListener(
                    socket,
                    (data as WebsocketMessage<WebsocketListenerType>)?.data,
                )
            } else if (data?.cmd === WebsocketCommand.REQUEST) {
                this.log.log(LogLevel.DEBUG, 'Received websocket request', str);
                void this.handleWsRequest(socket, (data as WebsocketMessage<Request>)?.data);
            } else {
                this.log.log(LogLevel.INFO, 'Received unknown websocket cmd', str);
            }
        } catch (e) {
            this.log.log(LogLevel.ERROR, `Failed to parse/handle websocket message`, e, str);
        }
    }

    private websocketRespond(socket: ws, response: Response | ResponsePart): Promise<void> {
        return new Promise((resolve, reject) => {
            socket.send(JSON.stringify({
                cmd: WebsocketCommand.RESPONSE,
                data: response,
            } as WebsocketMessage<Response>), (e) => {
                if (e) {
                    reject(e);
                } else {
                    resolve();
                }
            });
        });
    }

    private async handleWsRequest(socket: ws, request: Request): Promise<void> {
        try {
            if (!request.uuid) {
                return;
            }
            if (!this.manager.initDone) {
                await this.websocketRespond(socket, new Response(503, '', request.uuid));
                return;
            }

            const handler = this.eventInterface.commandMap?.get(request.resource);
            if (!handler || handler.disableRest) {
                await this.websocketRespond(socket, new Response(501, '', request.uuid));
                return;
            }

            const internalRequest = new Request();
            internalRequest.accept = request.accept ?? 'application/json';
            internalRequest.body = request.body;
            internalRequest.query = request.query;
            internalRequest.resource = request.resource;
            internalRequest.user = this.wsClients.get(socket).user;
            internalRequest.canStream = true;

            const internalResponse = await this.eventInterface.execute(
                internalRequest,
                /* istanbul ignore next */ (part) => this.websocketRespond(socket, part),
            );

            await this.websocketRespond(socket, internalResponse);
        } catch (e) {
            this.log.log(LogLevel.ERROR, `Failed to handle websocket request`, e, request);
        }
    }

    private setupExpress(): void {
        // cors
        this.express.all(
            '*',
            /* istanbul ignore next */
            (req, res, next) => this.handleCors(req, res, next),
        );

        this.express.get(
            '/login',
            /* istanbul ignore next */
            (req, res) => this.handleUiFileRequest(req, res),
        );
        this.express.get(
            '/dashboard/*',
            /* istanbul ignore next */
            (req, res) => this.handleUiFileRequest(req, res),
        );
        this.express.get(
            '/dashboard',
            /* istanbul ignore next */
            (req, res) => this.handleUiFileRequest(req, res),
        );
    }

    private handleCors(req: express.Request, res: express.Response, next: express.NextFunction): void {
        const origin = req.header('Origin')?.toLowerCase() ?? '';
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Credentials', 'true');

        if (req.method?.toLowerCase() === 'options') {
            res.sendStatus(204);
            return;
        }

        next();
    }

    private handleUiFileRequest(req: express.Request, res: express.Response): void {
        res.sendFile(path.join(this.UI_FILES, 'index.html'));
    }

    private async setupRouter(): Promise<void> {

        const users: { [k: string]: string } = {};
        for (const user of (this.manager.config?.admins ?? [])) {
            users[user.userId] = user.password;
        }
        this.router.use((basicAuth as any)({ users, challenge: false }));

        // Add IP country lookup endpoint
        this.router.get('/ip-country/:ip', async (req, res) => {
            try {
                if (!this.manager.initDone) {
                    res.sendStatus(503);
                    return;
                }

                const ip = req.params.ip;
                
                // Skip authentication for this endpoint since it's simple data lookup
                // Get the geolocation service from the container
                const geoLocationService = container.resolve(GeoLocation);
                
                // Get country from IP
                const country = await geoLocationService.getCountryFromIp(ip);
                
                // Return the result
                res.json({ country });
            } catch (error) {
                this.log.log(LogLevel.ERROR, `Error in IP country lookup: ${error.message}`);
                res.status(500).json({ error: 'Server error' });
            }
        });

        const commandMap = this.eventInterface.commandMap || new Map();
        for (const [resource, command] of commandMap) {

            if (command.disableRest) continue;

            this.log.log(LogLevel.DEBUG, `Registering ${command.method} ${resource}`);
            (this.router as any)[command.method](
                `/${resource}`,
                /* istanbul ignore next */
                (req, res) => {
                    void this.handleCommand(
                        req,
                        res,
                        resource,
                    );
                },
            );
        }
    }

    private async handleCommand(
        req: express.Request,
        res: express.Response,
        resource: string,
    ): Promise<void> {
        if (!this.manager.initDone) {
            res.sendStatus(503);
            return;
        }

        const base64Credentials = req.headers.authorization?.split(' ')[1];
        const username = base64Credentials
            ? Buffer.from(base64Credentials, 'base64')?.toString('utf-8')?.split(':')[0]
            : '';

        const internalRequest = new Request();
        internalRequest.accept = req.headers.accept ?? 'application/json';
        internalRequest.body = req.body;
        internalRequest.query = req.query;
        internalRequest.resource = resource;
        internalRequest.user = username;

        const internalResponse = await this.eventInterface.execute(internalRequest);

        res.status(internalResponse.status).send(internalResponse.body);
    }

    public stop(): Promise<void> {
        return new Promise<void>((r, e) => {
            if (!this.server || !this.server.listening) {
                r();
            }

            const wsClients = [...(this.wsClients?.entries() || [])];
            for (const client of wsClients) {
                client[1]?.listeners?.forEach((listener) => listener.off());
                client[0].close(1001);
            }
            this.wsClients = undefined;

            this.server?.close((error) => {
                if (error) {
                    e(error);
                } else {
                    r();
                }
            });
        });
    }

}
