'use strict';

/**
 * New Relic Agent Configuration
 * 
 * Se auto-desabilita quando NEW_RELIC_LICENSE_KEY não está presente
 */

exports.config = {
	app_name: [process.env.NEW_RELIC_APP_NAME || 'nexo-ai'],
	license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
	
	// Desabilita em development OU se não houver license key
	agent_enabled: 
		process.env.NODE_ENV !== 'development' && 
		!!process.env.NEW_RELIC_LICENSE_KEY &&
		process.env.NEW_RELIC_ENABLED === 'true',
	
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
