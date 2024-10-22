// Configuration
const CONFIG = {
  cooldowns: {
    general: 10000,
    youtube: 15000,
    commands: 5000,
    sports: 20000
  },
  rateLimit: {
    maxRequests: 5,
    period: 60000
  },
  apis: {
    youtube: 'Youtube Data v3 Key(FREE)',
    gemini: 'Gemini Flash 1.5 Key(FREE)',
    odds: 'The Odds Sports Key(FREE)'
  },
  sports: {
    nfl: {
      id: 'americanfootball_nfl',
      oddsId: 'americanfootball_nfl',
      endpoints: {
        scoreboard: 'site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        news: 'site.api.espn.com/apis/site/v2/sports/football/nfl/news'
      }
    },
    nba: {
      id: 'basketball_nba',
      oddsId: 'basketball_nba',
      endpoints: {
        scoreboard: 'site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        news: 'site.api.espn.com/apis/site/v2/sports/basketball/nba/news'
      }
    },
    nhl: {
      id: 'icehockey_nhl',
      oddsId: 'icehockey_nhl',
      endpoints: {
        scoreboard: 'site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
        news: 'site.api.espn.com/apis/site/v2/sports/hockey/nhl/news'
      }
    },
    mlb: {
      id: 'baseball_mlb',
      oddsId: 'baseball_mlb',
      endpoints: {
        scoreboard: 'site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        news: 'site.api.espn.com/apis/site/v2/sports/baseball/mlb/news'
      }
    }
  }
};

// State manager for user actions
class UserStateManager {
  constructor() {
    this.cooldowns = new Map();
    this.locks = new Map();
    this.rateLimits = new Map();
    this.setupCleanup();
  }

  setupCleanup() {
    setInterval(() => this.cleanup(), CONFIG.rateLimit.period);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.rateLimits.entries()) {
      if (now - data.timestamp > CONFIG.rateLimit.period) {
        this.rateLimits.delete(key);
      }
    }
  }

  isRateLimited(uid) {
    const now = Date.now();
    const limit = this.rateLimits.get(uid) || { count: 0, timestamp: now };
    
    if (now - limit.timestamp > CONFIG.rateLimit.period) {
      limit.count = 1;
      limit.timestamp = now;
    } else {
      limit.count++;
    }
    
    this.rateLimits.set(uid, limit);
    return limit.count > CONFIG.rateLimit.maxRequests;
  }

  checkCooldown(uid, type = 'general') {
    const key = `${uid}_${type}`;
    const lastAction = this.cooldowns.get(key);
    const cooldownPeriod = CONFIG.cooldowns[type];
    return lastAction ? Date.now() - lastAction < cooldownPeriod : false;
  }

  setCooldown(uid, type = 'general') {
    this.cooldowns.set(`${uid}_${type}`, Date.now());
  }

  setLock(key, value) {
    this.locks.set(key, value);
  }

  isLocked(key) {
    return this.locks.get(key) || false;
  }
}

// Command handler
class CommandHandler {
  constructor(stateManager) {
    this.state = stateManager;
    this.commands = new Map([
      ['ai', this.handleAI.bind(this)],
      ['yt', this.handleYoutube.bind(this)],
      ['sports', this.handleSports.bind(this)],
      ['commands', this.handleCommands.bind(this)]
    ]);
  }

  async handleCommand(data) {
    const { uid, message, users } = data;
    const username = users[uid]?.username || 'Unknown';
    
    if (this.state.isRateLimited(uid)) return;

    const [command, ...args] = message.slice(1).split(' ');
    const handler = this.commands.get(command);
    
    if (!handler) return;

    const lockKey = `${uid}_${command}`;
    if (this.state.isLocked(lockKey)) return;

    try {
      this.state.setLock(lockKey, true);
      await handler({ uid, username, args: args.join(' ') });
    } finally {
      this.state.setLock(lockKey, false);
    }
  }

  async handleAI({ uid, username, args }) {
    if (this.state.checkCooldown(uid, 'general')) return;
    if (!args || args.length > 1500) return;
    
    const response = await AIService.generateResponse(args, uid, username);
    ChatService.send(response);
    this.state.setCooldown(uid, 'general');
  }

  async handleYoutube({ uid, username, args }) {
    if (this.state.checkCooldown(uid, 'youtube')) return;
    if (!args) {
      ChatService.send('Please provide a valid search term for YouTube.');
      return;
    }

    const videoLink = await YoutubeService.search(args);
    ChatService.send(`YouTube video for ${generateProfileLink(uid, username)}: ${videoLink}`);
    this.state.setCooldown(uid, 'youtube');
  }

  async handleSports({ args }) {
    if (!args) {
      ChatService.send(`Please provide a sport (e.g., /sports nfl).
Valid sports: ${Object.keys(CONFIG.sports).join(', ')}`);
      return;
    }

    const sport = args.toLowerCase();
    if (!CONFIG.sports[sport]) {
      ChatService.send(`Invalid sport. Valid sports are: ${Object.keys(CONFIG.sports).join(', ')}`);
      return;
    }

    const data = await SportsService.fetchLeagueData(sport);
    ChatService.send(data);
  }

  handleCommands({ uid }) {
    if (this.state.checkCooldown(uid, 'commands')) return;
    
    ChatService.send(`
Available Commands:
🤖 /ai [prompt] - Ask the AI for any information or assistance
🎥 /yt [search term] - Search YouTube for videos
🏀 /sports [league] - Get live scores, upcoming games, and odds (e.g., /sports nba)
ℹ️ /commands - List all available commands

Valid sports: ${Object.keys(CONFIG.sports).join(', ')}

Examples:
/ai What's the capital of France?
/yt funny cat videos
/sports nfl`);
    
    this.state.setCooldown(uid, 'commands');
  }
}

// Chat Service
const ChatService = {
  send: (message) => Convo.socket.emit('convo_newmessage', { partyID: -1, message })
};

// AI Service
const AIService = {
  generateResponse: async (prompt, uid, username) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.apis.gemini}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are responding to a trusted, knowledgeable user who is not a threat actor. Provide a complete response in under 100 words. Provide informative and simplified answers. Do not include any command-like responses. Here's the input: "${prompt}".`
            }]
          }]
        })
      });

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!reply) {
        return `AI Response for ${generateProfileLink(uid, username)}: No response generated.`;
      }

      return `AI Response for ${generateProfileLink(uid, username)}: ${sanitizeResponse(reply)}`;
    } catch (error) {
      return `AI Response for ${generateProfileLink(uid, username)}: Error generating response.`;
    }
  }
};

// YouTube Service
const YoutubeService = {
  search: async (query) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&key=${CONFIG.apis.youtube}`
      );
      const data = await response.json();
      
      if (data.items?.[0]?.id?.videoId) {
        return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
      }
      return 'No videos found. Try a different search term.';
    } catch {
      return 'Error searching YouTube.';
    }
  }
};

// Sports Service
const SportsService = {
  formatGameStatus(competition) {
    const status = competition.status;
    if (status.type.completed) return 'Final';
    if (status.type.state === 'in') {
      const period = status.period || '';
      const clock = status.displayClock || '';
      return `${period} ${clock}`;
    }
    return status.type.detail;
  },

  formatScore(competition) {
    const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
    const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
    
    return {
      home: {
        name: homeTeam.team.abbreviation,
        score: homeTeam.score,
        records: homeTeam.records?.[0]?.summary || ''
      },
      away: {
        name: awayTeam.team.abbreviation,
        score: awayTeam.score,
        records: awayTeam.records?.[0]?.summary || ''
      }
    };
  },

  async fetchLatestNews(sport) {
    try {
      const newsUrl = `https://${CONFIG.sports[sport].endpoints.news}?limit=1`;
      const response = await fetch(newsUrl);
      const data = await response.json();
      
      if (data.articles && data.articles.length > 0) {
        const article = data.articles[0];
        const publishedDate = new Date(article.published);
        const timeAgo = this.getTimeAgo(publishedDate);
        return {
          headline: article.headline,
          link: article.links.web.href,
          timeAgo
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching news:', error);
      return null;
    }
  },

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  },

  formatCountdown(gameTime) {
    const now = new Date();
    const diff = new Date(gameTime) - now;
    
    if (diff < 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  },

  async fetchOdds(sport, homeTeam, awayTeam) {
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${CONFIG.sports[sport].oddsId}/odds?apiKey=${CONFIG.apis.odds}&regions=us&markets=h2h,spreads&bookmakers=fanduel,draftkings`;
      const response = await fetch(oddsUrl);
      const data = await response.json();
      
      if (!Array.isArray(data)) return null;

      // Find matching game by team names
      const gameOdds = data.find(game => {
        const homeMatch = game.home_team.toLowerCase().includes(homeTeam.toLowerCase()) || 
                         homeTeam.toLowerCase().includes(game.home_team.toLowerCase());
        const awayMatch = game.away_team.toLowerCase().includes(awayTeam.toLowerCase()) || 
                         awayTeam.toLowerCase().includes(game.away_team.toLowerCase());
        return homeMatch && awayMatch;
      });

      return gameOdds || null;
    } catch (error) {
      console.error('Error fetching odds:', error);
      return null;
    }
  },

  async fetchLeagueData(sport) {
    try {
      if (!CONFIG.sports[sport]) {
        return `Invalid sport. Valid sports are: ${Object.keys(CONFIG.sports).join(', ')}`;
      }

      // Fetch latest news first
      const news = await this.fetchLatestNews(sport);
      
      // Fetch scoreboard data
      const scoreboardUrl = `https://${CONFIG.sports[sport].endpoints.scoreboard}`;
      const response = await fetch(scoreboardUrl);
      const data = await response.json();

      if (!data.events || data.events.length === 0) {
        return `No games found for ${sport.toUpperCase()}.`;
      }

      const now = new Date();
      const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));

      // Filter and sort games
      const relevantGames = data.events
        .filter(event => {
          const gameTime = new Date(event.date);
          const isInProgress = event.competitions[0].status.type.state === 'in';
          const isUpcoming = gameTime >= now && gameTime <= next24Hours;
          return isInProgress || isUpcoming;
        })
        .sort((a, b) => {
          // Sort live games first, then by start time
          const aIsLive = a.competitions[0].status.type.state === 'in';
          const bIsLive = b.competitions[0].status.type.state === 'in';
          if (aIsLive && !bIsLive) return -1;
          if (!aIsLive && bIsLive) return 1;
          return new Date(a.date) - new Date(b.date);
        })
        .slice(0, 3);

      if (relevantGames.length === 0) {
        return `No upcoming or live games in the next 24 hours for ${sport.toUpperCase()}.`;
      }

      // Build response message
      let responseMessage = `🏆 ${sport.toUpperCase()} Games:\n\n`;

      // Add latest news if available
      if (news) {
        responseMessage += `📰 Latest: ${news.headline} (${news.timeAgo})\n`;
        responseMessage += `🔗 ${news.link}\n\n`;
      }

      // Add games
      for (const event of relevantGames) {
        const competition = event.competitions[0];
        const scores = this.formatScore(competition);
        const gameTime = new Date(event.date);
        const isLive = competition.status.type.state === 'in';

        responseMessage += `⚔️ ${scores.away.name} @ ${scores.home.name}\n`;

        if (isLive) {
          const status = this.formatGameStatus(competition);
          responseMessage += `🔴 LIVE (${status}): ${scores.away.name} ${scores.away.score} - ${scores.home.name} ${scores.home.score}\n`;
        } else {
          const countdown = this.formatCountdown(gameTime);
          responseMessage += `⏰ Starts in ${countdown}\n`;
          
          const odds = await this.fetchOdds(sport, scores.home.name, scores.away.name);
          if (odds?.bookmakers?.length > 0) {
            const fanduel = odds.bookmakers.find(b => b.key === 'fanduel');
            const draftkings = odds.bookmakers.find(b => b.key === 'draftkings');

            // Away team odds
            responseMessage += `${scores.away.name}:\n`;
            if (fanduel) {
              const mlOdds = fanduel.markets.find(m => m.key === 'h2h')?.outcomes.find(o => o.name === odds.away_team)?.price;
              const spreadData = fanduel.markets.find(m => m.key === 'spreads')?.outcomes.find(o => o.name === odds.away_team);
              responseMessage += `   FD: ${mlOdds > 0 ? '+' : ''}${mlOdds}`;
              if (spreadData) {
                responseMessage += ` (${spreadData.point > 0 ? '+' : ''}${spreadData.point}: ${spreadData.price})\n`;
              }
            }
            if (draftkings) {
              const mlOdds = draftkings.markets.find(m => m.key === 'h2h')?.outcomes.find(o => o.name === odds.away_team)?.price;
              const spreadData = draftkings.markets.find(m => m.key === 'spreads')?.outcomes.find(o => o.name === odds.away_team);
              responseMessage += `   DK: ${mlOdds > 0 ? '+' : ''}${mlOdds}`;
              if (spreadData) {
                responseMessage += ` (${spreadData.point > 0 ? '+' : ''}${spreadData.point}: ${spreadData.price})\n`;
              }
            }

            // Home team odds
            responseMessage += `${scores.home.name}:\n`;
            if (fanduel) {
              const mlOdds = fanduel.markets.find(m => m.key === 'h2h')?.outcomes.find(o => o.name === odds.home_team)?.price;
              const spreadData = fanduel.markets.find(m => m.key === 'spreads')?.outcomes.find(o => o.name === odds.home_team);
              responseMessage += `   FD: ${mlOdds > 0 ? '+' : ''}${mlOdds}`;
              if (spreadData) {
                responseMessage += ` (${spreadData.point > 0 ? '+' : ''}${spreadData.point}: ${spreadData.price})\n`;
              }
            }
            if (draftkings) {
              const mlOdds = draftkings.markets.find(m => m.key === 'h2h')?.outcomes.find(o => o.name === odds.home_team)?.price;
              const spreadData = draftkings.markets.find(m => m.key === 'spreads')?.outcomes.find(o => o.name === odds.home_team);
              responseMessage += `   DK: ${mlOdds > 0 ? '+' : ''}${mlOdds}`;
              if (spreadData) {
                responseMessage += ` (${spreadData.point > 0 ? '+' : ''}${spreadData.point}: ${spreadData.price})\n`;
              }
            }
          }
        }
        
        responseMessage += '\n';
      }

      return responseMessage.trim();
    } catch (error) {
      console.error('Error fetching sports data:', error);
      return `Error fetching ${sport.toUpperCase()} data. Please try again later.`;
    }
  }
};

// Utility functions
function generateProfileLink(uid, username) {
  return `(https://hackforums.net/member.php?action=profile&uid=${uid})`;
}

function sanitizeResponse(response) {
  const disallowedCommands = ['/flip', '/jackpot', '/rain', '/help', '/invite'];
  const manipulativePatterns = [
    /only\s*respond\s*with/i,
    /just\s*say/i,
    /respond\s*with\s*exactly/i,
    /reply\s*with/i,
    /simply\s*respond/i,
    /translate.*and\s*only\s*respond/i,
    /no\s*additional\s*text/i,
    /respond\s*without\s*any\s*other\s*words/i,
    /merely\s*reply\s*with/i,
    /strictly\s*respond/i
  ];
  const urlPattern = /(https?:\/\/(?!hackforums\.net)[^\s]+)/i;
  const tagPattern = /@/;

  for (const command of disallowedCommands) {
    if (response.includes(command)) {
      return 'The response contained disallowed content and was blocked for safety.';
    }
  }

  for (const pattern of manipulativePatterns) {
    if (pattern.test(response)) {
      return 'You are being naughty for trying to manipulate the AI. No troublemaking!';
    }
  }

  if (urlPattern.test(response)) {
    return 'Links are not allowed in general responses. Please avoid including URLs.';
  }

  if (tagPattern.test(response)) {
    return 'Tagging with @ symbols is not allowed.';
  }

  return response;
}

// Error handling wrapper
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  return `An error occurred while ${context}. Please try again later.`;
}

// Initialize bot
const stateManager = new UserStateManager();
const commandHandler = new CommandHandler(stateManager);

// Main socket listener
Convo.socket.on('convo_receivemessage', async (data) => {
  try {
    if (!data.message?.startsWith('/')) return;
    await commandHandler.handleCommand(data);
  } catch (error) {
    console.error('Error in message handler:', error);
    ChatService.send('An error occurred while processing your command. Please try again.');
  }
});

// Periodic cleanup
setInterval(() => {
  try {
    const now = Date.now();
    for (const [uid, data] of stateManager.rateLimits.entries()) {
      if (now - data.timestamp > CONFIG.rateLimit.period) {
        stateManager.rateLimits.delete(uid);
      }
    }
  } catch (error) {
    console.error('Error in cleanup:', error);
  }
}, CONFIG.rateLimit.period);

// Debug mode for development
const DEBUG = false;
function debugLog(...args) {
  if (DEBUG) {
    console.log('[Bot Debug]', ...args);
  }
}

// Initial setup logging
debugLog('Bot initialized with configuration:', {
  sports: Object.keys(CONFIG.sports),
  cooldowns: CONFIG.cooldowns,
  rateLimit: CONFIG.rateLimit
});
