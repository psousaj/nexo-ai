'use strict';

/**
 * New Relic Agent Configuration
 * 
 * Se auto-desabilita quando NEW_RELIC_LICENSE_KEY não está presente
 */

exports.config = {
	app_name: [process.env.NEW_RELIC_APP_NAME || 'nexo-ai'],
	license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
	
	// Desabilita completamente se não houver license key
	agent_enabled: !!process.env.NEW_RELIC_LICENSE_KEY,
	
	logging: {
		level: 'info',
		filepath: 'stdout',
	},
	
	distributed_tracing: {
		enabled: true,
	},
	
	application_logging: {
		enabled: true,
		forwarding: {
			enabled: true,
		},
		local_decorating: {
			enabled: false,
		},
	},
};
