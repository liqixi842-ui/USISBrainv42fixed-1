// v3-dev Bot Configuration
// Dual Bot Setup: Production and Development

module.exports = {
  // Production Bot (v2-stable)
  production: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    tag: 'prod_bot',
    version: 'v2-stable',
    routes: 'root', // Uses root-level routes
    description: 'Production bot for real users',
    features: [
      'Multi-AI analysis',
      'News system',
      'Chart generation',
      'Cost tracking'
    ]
  },

  // Development Bot (v3-dev)
  development: {
    token: process.env.TELEGRAM_BOT_TOKEN_DEV,
    tag: 'dev_bot',
    version: 'v3-dev',
    routes: '/v3_dev/routes', // Uses v3_dev routes only
    description: 'Development bot for testing new features',
    features: [
      'Research report system (in development)',
      'Experimental features'
    ]
  },

  // Isolation settings
  isolation: {
    separatePolling: true,
    separateWebhooks: true,
    noCrossContamination: true
  },

  // Check if both bots are configured
  isBothConfigured() {
    return !!(this.production.token && this.development.token);
  },

  // Get active bots
  getActiveBots() {
    const active = [];
    if (this.production.token) active.push('prod_bot');
    if (this.development.token) active.push('dev_bot');
    return active;
  },

  // Validation
  validate() {
    const results = {
      production: !!this.production.token,
      development: !!this.development.token,
      isolated: this.production.token !== this.development.token
    };
    return results;
  }
};
