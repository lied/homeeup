const Logger = require('logplease');
const logger = Logger.create('SimpleCMDPlugin');
import { PluginInterface } from "./PluginInterface";
import { HMLCSW1 } from "../devices/HMLCSW1";
const { exec } = require('child_process');

export class SimpleCMDPlugin implements PluginInterface {

    name: String = 'SimpleCMDPlugin';
    devices = [];
    onCmd: String;
    offCmd: String;
    statusCmd: String;
    checkInterval: number;
    pauseCheckIntervalAfterSwitch : number;
    checkIntervalPaused: boolean = false;

    init(p) {
        logger.debug('init(%s)', JSON.stringify(p));
        this.onCmd = p.pluginParams.onCmd;
        this.offCmd = p.pluginParams.offCmd;
        this.statusCmd = p.pluginParams.statusCmd;
        this.checkInterval = p.pluginParams.checkInterval;
        this.pauseCheckIntervalAfterSwitch = p.pluginParams.pauseCheckIntervalAfterSwitch;

        let device = new HMLCSW1(p.deviceName);
        device.events.on('onTurnOn', this.onTurnOn.bind(this));
        device.events.on('onTurnOff', this.onTurnOff.bind(this));
        this.devices.push(device);

        var that = this;
        setInterval(function() {
            if(!that.checkIntervalPaused)
                that._checkStatus(device, false);
            else
                logger.info('Checking status is paused.', that.name);
        }, that.checkInterval);
        that._checkStatus(device, true);

        logger.info('Plugin %s initialized.', this.name);

        return this.devices;
    }

    onTurnOn(device) {
        logger.debug('onTurnOn()');
        logger.info('Device %s turned on.', device.deviceName);
        logger.info('Executing onCmd.');
        let that = this;
        that._pauseCheckStatus();
        exec(this.onCmd, function(err, stdout, stderr) {
            if(err) {
                logger.error('onCmd failed with error %s', err);
                return;
            }
            logger.info('onCmd executed successfully.');
        });
    }

    onTurnOff(device) {
        logger.debug('onTurnOff()');
        logger.info('Device %s turned off.', device.deviceName);
        logger.info('Executing offCmd.');
        let that = this;
        that._pauseCheckStatus();
        exec(this.offCmd, function(err, stdout, stderr) {
            if(err) {
                logger.error('offCmd failed with error %s', err);
                return;
            }
            logger.info('offCmd executed successfully.');
        });
    }

    _checkStatus(device, forceRefresh) {
        logger.debug('_checkStatus(%s)', forceRefresh);
        var that = this;
        logger.info('Checking status of %s.', device.deviceName);
        exec(that.statusCmd, function(err, stdout, stderr) {
            if(that.checkIntervalPaused)
                return;
            if(err) {
                logger.error('statusCmd failed with error %s', err);
                return;
            }
            let val = stdout==='0\n';
            if(val !== device.state1 || forceRefresh) {
                logger.info('Status of %s changed to %s.', device.deviceName, val);
                if(!forceRefresh)
                    that._pauseCheckStatus();
                device.stateChanged(1, val);
            }
            else {
                logger.info('Status of %s has not changed.', device.deviceName);
            }
        });
    }

    _pauseCheckStatus() {
        let that = this;
        if(!that.pauseCheckIntervalAfterSwitch || that.checkIntervalPaused)
            return;
        that.checkIntervalPaused = true;
        setTimeout(function() {
            that.checkIntervalPaused = false;
        }, that.pauseCheckIntervalAfterSwitch);
    }

}