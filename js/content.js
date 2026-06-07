/* ============================================================
   CONTENT — portfolio data + character dialogue
   Edit text freely; structure is read by the rest of the app.
   ============================================================ */
window.CONTENT = {
  owner: {
    name: "Ryan Huang",
    site: "ryanhuang.work",
    email: "ryanhuang1234567890@gmail.com",
    linkedin: "https://www.linkedin.com/in/kerui-huang/",
    github: "https://github.com/"
  },

  // ---- Header panels ----
  about: {
    kicker: "About",
    title: "Hi, I'm Ryan 👋",
    lead: "Developer, builder, and lover of interactive experiences. I like turning ordinary pages into little worlds you can actually walk around in — this portfolio being exhibit A.",
    items: [
      { h: "What I do", meta: "Focus", p: "Full-stack & creative front-end engineering. I care about the feel of a thing — motion, responsiveness, the small details that make software fun.", tags:["TypeScript","React","Node","Canvas / WebGL","Pixel art"] },
      { h: "How I think", meta: "Approach", p: "Ship something playable early, then polish relentlessly. I'd rather build a tiny world that delights than a big page that bores." },
      { h: "Outside the editor", meta: "Off the clock", p: "Chess (badly), making music, and over-engineering my own portfolio website instead of sleeping." }
    ]
  },
  experience: {
    kicker: "Experience",
    title: "Where I've worked",
    lead: "A few of the roles and projects that shaped how I build.",
    items: [
      { h: "Software Engineer", meta: "Most recent", p: "Built and shipped production web features end-to-end — design systems, performant UI, and the glue that holds a product together.", tags:["React","TypeScript","Design systems"] },
      { h: "Full-Stack Developer", meta: "Before that", p: "Owned features from database to pixel. APIs, auth, data flows, and front-ends that didn't make people sigh.", tags:["Node","Postgres","REST"] },
      { h: "Creative / Game-ish builds", meta: "Always", p: "Interactive sites, canvas toys, and this very world. Where engineering meets play.", tags:["Canvas","Animation","Audio"] }
    ]
  },
  projects: {
    kicker: "Projects",
    title: "Things I've built",
    lead: "A sampler. The best demo is the one you're standing in.",
    items: [
      { h: "This World", meta: "Interactive portfolio", p: "A walkable, four-room pixel world with NPCs, a playable chess engine, and a music studio. No frameworks fighting me — just canvas and care.", tags:["Canvas","Game loop","Chess AI"] },
      { h: "Chess vs. Drod", meta: "In the Game Room", p: "A from-scratch chess engine with selectable difficulty and a trash-talking opponent. Go beat him.", tags:["Minimax","Alpha-beta","Heuristics"] },
      { h: "The Studio", meta: "In the Music Room", p: "A jukebox plus a tap-to-play beat pad with a live visualizer. Make a little noise.", tags:["Web Audio","Sequencer"] }
    ]
  },
  contact: {
    kicker: "Contact",
    title: "Let's talk",
    lead: "Collaborations, opportunities, or just to say hi — I'm around.",
  },

  // ---- Characters ----
  // role: where each lives. portrait + sprite filenames match assets folders.
  characters: {
    Drod: { name:"Drod", room:"game", color:"#caa23a",
      lines:[
        "Oh, a challenger. Ryan keeps sending me people to humble.",
        "He built this whole chess engine just so I'd have someone to beat. Sweet of him, really.",
        "Pull up a chair. Press {ENTER} at the board and pick your poison — I go easy… sometimes."
      ] },
    Alex: { name:"Alex", room:"music", color:"#5fb0c9",
      lines:[
        "Yo! Welcome to the studio. Ryan basically lives in here when he's 'taking a break'.",
        "Dude wired up a whole jukebox AND a beat pad. Said a portfolio should make noise.",
        "Step on the booth and press {ENTER} — let's hear what you've got."
      ] },
    DJ: { name:"DJ", room:"music", color:"#b07acb",
      lines:[
        "Ryan's got taste, I'll give him that. Every track in here, he picked.",
        "He says music's just code you can feel. Kinda corny. Kinda true.",
        "Hit the decks and make something — nobody's judging. (I'm judging a little.)"
      ] },
    Bob: { name:"Bob", room:"lounge", color:"#d98a5a",
      lines:[
        "Ahh, the lounge. Best seat in Ryan's world if you ask me.",
        "I've known Ryan a while. Guy ships fast and polishes everything to death — in a good way.",
        "Check the header up top for his Experience and Projects. Or just wander, that's the point."
      ] },
    Dino: { name:"Dino", room:"lounge", color:"#69b06a",
      lines:[
        "Rawr. That's hello in lounge-speak.",
        "Ryan drew this whole place tile by tile. Took him forever. Worth it though, right?",
        "Up north there's a gym, west has chess, east is the music studio. Go explore!"
      ] },
    Girl: { name:"Amelia", room:"gym", color:"#e58aa6",
      lines:[
        "Leg day! Ryan never skips it. Says debugging is cardio for the brain.",
        "He's stubborn — keeps grinding a problem till it cracks. You can tell from his commits.",
        "Want the formal stuff? Tap 'Experience' in the header. Or spot me on the bench, ha."
      ] },
    Gojo: { name:"Gojo", room:"gym", color:"#7aa0e5",
      lines:[
        "Throughout heaven and earth, I alone am the strongest… spotter.",
        "Ryan trains like he codes — full focus, no half reps. Respect.",
        "Hit the 'Projects' tab up top if you want proof. The man builds."
      ] }
  },

  // tracks for the music room
  tracks: [
    { name:"Midnight Loop",  file:"assets/audio/track1.wav" },
    { name:"Pixel Sunrise",  file:"assets/audio/track2.wav" },
    { name:"Studio Haze",    file:"assets/audio/track3.wav" },
    { name:"Neon Drive",     file:"assets/audio/track4.mp3" },
    { name:"After Hours",    file:"assets/audio/track5.wav" }
  ]
};
