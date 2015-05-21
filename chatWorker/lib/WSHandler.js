var socketio = require('socket.io');
var http = require('http');
var redisAdaptater = require('socket.io-redis');
var debugFactory = require('debug');
var _ = require('lodash');
var store_1 = require('./store');
var WSHandler = (function () {
    function WSHandler(conf) {
        var _this = this;
        this._onConnection = function (socket) {
            _this._debug('Got connection %s from %s', socket.id, socket.client.conn.remoteAddress);
            _this._sockets.push(new ChatUpSocket(socket, _this));
        };
        this._debug = debugFactory('ChatUp:ChatWorker:slave:' + process.pid);
        this._debug('Slave init');
        this._conf = conf;
        this._app = http.createServer();
        this._io = socketio(this._app, {
            serverClient: false
        });
        this._store = new store_1.Store(this);
        this._io.on('connection', this._onConnection);
        this._sockets = [];
    }
    Object.defineProperty(WSHandler.prototype, "server", {
        get: function () {
            return this._app;
        },
        enumerable: true,
        configurable: true
    });
    return WSHandler;
})();
exports.WSHandler = WSHandler;
var ChatUpSocket = (function () {
    function ChatUpSocket(socket, parent) {
        var _this = this;
        this._onAuth = function (msg, cb) {
            if (!_.isObject(msg) || !_.isString(msg.name)) {
                return cb({ status: 'error', err: "Wrong format" });
            }
            _this._user = {
                _public: {
                    name: msg.name
                }
            };
            _this._debug('Authentified', _this._socket.id);
            cb('ok');
        };
        this._onJoin = function (msg, cb) {
            if (!_.isObject(msg) || !_.isString(msg.room)) {
                return cb({ status: 'error', err: "Wrong format" });
            }
            if (_this._room) {
                return cb({ status: 'error', err: "Already in a room" });
            }
            _this._room = _this._parent._store.joinRoom(msg.room);
            _this._room.onMsg(_this._onMsg);
            _this._debug('Joined room %s', _this._room.name);
            cb('ok');
        };
        this._onMsg = function (messages) {
            _this._debug('Sending %s messages', messages.length);
            _this._socket.emit('msg', messages);
        };
        this._onSay = function (msg, cb) {
            if (!_.isObject(msg) || !_.isString(msg.msg)) {
                return cb({ status: 'error', err: 'Wrong format' });
            }
            if (!_this._room) {
                return cb({ status: 'error', err: 'Never joined a room' });
            }
            _this._room.say({
                user: _this._user._public,
                msg: msg.msg
            });
            _this._debug('Saying', msg.msg);
            cb('ok');
        };
        this._onDisconnect = function () {
            _this._debug('Client %s disconnected', _this._socket.id);
            if (_this._room) {
                _this._room.quit();
            }
        };
        this._debug = debugFactory('ChatUp:ChatWorker:client:' + socket.id);
        this._socket = socket;
        this._parent = parent;
        this._debug('New connection %s from %s', socket.id, socket.client.conn.remoteAddress);
        this._socket.on('auth', this._onAuth);
        this._socket.on('join', this._onJoin);
        this._socket.on('say', this._onSay);
        this._socket.on('disconnect', this._onDisconnect);
    }
    return ChatUpSocket;
})();
