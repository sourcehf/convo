# HF Socket Chat Bot

A JavaScript-based chat bot for HackForums socket chat that provides AI responses, YouTube search, and live sports data with odds.

## Features

- **AI Responses** (`/ai`): Uses Gemini API for intelligent chat responses
- **YouTube Search** (`/yt`): Quick video lookup and sharing
- **Live Sports Data** (`/sports`): 
  - Live scores and upcoming games for NFL, NBA, NHL, MLB
  - Game countdowns
  - Live odds from FanDuel and DraftKings
  - Latest league news
- **Rate limiting and cooldowns** to prevent spam
- **User-specific locks** to prevent command abuse

## Commands

- 🤖 /ai [prompt] - Ask the AI for information/assistance
- 🎥 /yt [search term] - Search YouTube for videos
- 🏀 /sports [league] - Get live scores, upcoming games, and odds
- ℹ️ /commands - List all available commands

## API Keys Required

You'll need to provide your own API keys:
- Google/YouTube API
- Google Gemini API
- The Odds API

## Known Issues / Limitations

- Code needs refactoring and better organization
- API keys are stored in plain text (should use env variables)
- Error handling could be improved
- Rate limiting might need adjustment based on usage
- Team name matching for odds could be more robust

## Future Improvements Needed

- [ ] Proper environment variable handling
- [ ] Better error handling and logging
- [ ] Code organization into proper modules
- [ ] Unit tests
- [ ] Better documentation
- [ ] More sports data sources
- [ ] Customizable cooldown periods
- [ ] Better odds matching system

## Contributing

Feel free to fork and improve! This was a quick project that works but could use community improvements. Pull requests are welcome.

## Disclaimer

This is a basic working implementation that could use improvements. The code is functional but not optimized or properly structured. Use at your own risk and improve as needed.

## License

MIT License - Feel free to use and modify as needed.

---

## Usage Example

1. Set up your API keys in the CONFIG object
2. Paste the script into your browser console while on HF chat
3. Use commands as needed

Example sports output:
🏆 NFL Games:
📰 Latest: [Recent League News] (2h ago)
🔗 [News Link]
⚔️ Team1 @ Team2
🔴 LIVE (Q4 2:30): Team1 24 - Team2 21
⚔️ Team3 @ Team4
⏰ Starts in 2h 30m
Team3:
FD: +150 (+3.5: -110)
DK: +155 (+3.5: -108)
Team4:
FD: -170 (-3.5: -110)
DK: -175 (-3.5: -112)

## To-Do

- [ ] Add more bookmakers for odds
- [ ] Add game stats
- [ ] Add player stats
- [ ] Add historical data
- [ ] Add prediction models
- [ ] Add more sports leagues
- [ ] Add proper configuration system
- [ ] Add proper logging system

Feel free to take this project and make it better! It was created as a quick solution but has potential for much more.
