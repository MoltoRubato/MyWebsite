/* ============================================================
   CONTENT — portfolio data + character dialogue
   Edit text freely; structure is read by the rest of the app.
   ============================================================ */
window.CONTENT = {
  owner: {
    name: "Kerui (Ryan) Huang",
    email: "ryanhuang1234567890@gmail.com",
    phone: "0481971130",
    phoneIntl: "+61481971130",
    phoneDisplay: "0481 971 130",
    linkedin: "https://www.linkedin.com/in/kerui-huang/",
    instagram: "https://www.instagram.com/itsryianx/"
  },

  // ---- Header panels ----
  about: {
    kicker: "About",
    name: "Kerui (Ryan) Huang",
    role: "Forward Deployed Engineer @ Lyra",
    location: "Melbourne, Australia",
    photo: "assets/photo/ryan.jpg",
    lead: "Turning ambiguous problems into shipped products.",
    bio: "I'm a Forward Deployed Engineer at Lyra, based in Melbourne. I study Computing and Software Systems at the University of Melbourne alongside a Diploma in Languages in German, graduating with First Class Honours. I build across the stack, from AI platforms to fintech tooling.",
    facts: [
      { label: "Education", value: "University of Melbourne. Bachelor majoring in Computing &amp; Software Systems, with a Diploma in Languages (German). First Class Honours (H1)." },
      { label: "Languages", value: "English, Mandarin, German" },
      { label: "Leadership", value: "Events Director, UniMelb Game Makers" }
    ],
    skills: ["Python","Java","C","SQL","JavaScript","C#","React","Node.js","PostgreSQL","LangChain","LangGraph","RAG","Git","Figma"]
  },
  experience: {
    kicker: "Experience",
    title: "Where I've worked",
    items: [
      { company:"Inherity", role:"Software Engineer", logo:"assets/logos/inherity.jpeg", period:"Apr 2026 – Present",
        p:"Built a secure document parser for a fintech platform, automating document extraction and verification to support faster approvals and early access to funds." },
      { company:"Lyra", role:"Forward Deployed Engineer", logo:"assets/logos/lyra.jpeg", period:"Feb 2026 – Present",
        p:"Founding engineer for Silicon Valley startups." },
      { company:"CSIRO", role:"Software Engineer", logo:"assets/logos/csiro.jpeg", period:"Jan 2026 – Mar 2026",
        p:"Built an AI-powered climate projection platform." },
      { company:"Deloitte", role:"Software Engineer", logo:"assets/logos/deloitte.jpeg", period:"Nov 2025 – Dec 2025",
        p:"Digital Workplace (DWP) team." },
      { company:"FSR Smart Consulting", role:"Software Engineer", logo:"assets/logos/fsr.jpeg", period:"Jun 2025 – Nov 2025",
        p:"AI and deepfake detection software." }
    ]
  },
  projects: {
    kicker: "Projects",
    title: "Selected Projects",
    items: [
      { h:"Airtable Clone", p:"Airtable clone built with the T3 stack." },
      { h:"AI Job Application Tailor", p:"AI-powered web application that generates tailored cover letters and resume bullet points from a candidate profile and job description." },
      { h:"Drone Delivery Simulation", p:"Optimized parcel delivery simulation focused on routing efficiency and system performance." },
      { h:"Book Recommendation System", p:"Data processing and recommendation engine built on publicly available book datasets." },
      { h:"Pinochle", p:"Desktop card game featuring GUI gameplay and an intelligent computer opponent." },
      { h:"Chessformer Puzzle Solver", p:"AI puzzle solver using optimized search techniques and duplicate-state reduction." }
    ]
  },
  contact: {
    kicker: "Contact",
    title: "Let's talk",
    lead: "Collaborations, opportunities, or just to say hi."
  },

  // ---- Characters ----
  // role: where each lives. portrait + sprite filenames match assets folders.
  // opens   = header tab a character can pull up ("about"/"experience"/"projects"/"contact").
  // openLabel/actLabel/noLabel = funny choice-button text (game.js builds the menu).
  characters: {
    Drod: { name:"Drod", room:"game", color:"#caa23a",
      opens:"projects", openLabel:"🧪 See the experiments",
      actLabel:"♟ Play a game", noLabel:"Maybe later",
      lines:[
        "Ah, another brave soul sent here to be 'humbled.' Apparently that's my entire purpose.",
        "Fun fact: I'm not real. Some guy coded me up over a weekend. I try not to dwell on it.",
        "Anyway. Face me at the board, or go gawk at his other little experiments. I'm exhibit A, by the way."
      ] },
    Alex: { name:"Alex", room:"music", color:"#5fb0c9",
      actLabel:"🎵 Open the studio", noLabel:"Just vibing",
      lines:[
        "Ayy, you found the studio! Watch the cables, a couple of 'em bite.",
        "The owner? Oh, he basically haunts this room. Pops in for a 'quick break,' leaves at 4am. Every time.",
        "Anyway, enough about the ghost who pays rent. Hop on the booth and let's hear you."
      ] },
    DJ: { name:"DJ", room:"music", color:"#b07acb",
      actLabel:"🎵 Open the studio", noLabel:"Just vibing",
      lines:[
        "Shh. Oh, false alarm, you're cool. Thought you were here about the noise complaint.",
        "Every track in this place got hand-picked by you-know-who. Man has VERY strong opinions about hi-hats.",
        "Enough chitchat. Get on the decks and cook something. I totally won't judge. (I'm judging.)"
      ] },
    Bob: { name:"Bob", room:"lounge", color:"#d98a5a",
      opens:"experience", openLabel:"📜 Show me the rundown", noLabel:"Nah, just resting",
      lines:[
        "Sit, sit. This couch has held fancier people than me, but it'll cope.",
        "Asking about the owner, huh? I've watched a lotta folks pass through this lounge.",
        "That Ryan's worked more places than I've taken naps, and buddy, I nap competitively. Want the rundown?"
      ] },
    Dino: { name:"Dino", room:"lounge", color:"#69b06a",
      opens:"about", openLabel:"🦖 Show me his file", noLabel:"I'll keep snooping",
      lines:[
        "Oh! A real-life person. We mostly get pigeons in here, so honestly this is big.",
        "Word is some guy named 'Ryan' owns this whole place. Never seen him. Little bit sus, if you ask me.",
        "I'm nosy though, so I looked him up. Wanna see what kind of person builds a dinosaur his own lounge?"
      ] },
    Girl: { name:"Amelia", room:"gym", color:"#e58aa6",
      opens:"contact", openLabel:"📇 Grab his contact", noLabel:"Just stretching",
      lines:[
        "Spotter's here! Drop the bar on your face and I'll gasp real convincing-like.",
        "Lemme guess: you're after the guy whose name's plastered all over this building?",
        "I'm not his secretary, but his contact's just sorta lying around over here. Don't make it weird."
      ] },
    Gojo: { name:"Gojo", room:"gym", color:"#7aa0e5",
      opens:"projects", openLabel:"📂 Show me his builds",
      actLabel:"🥊 Hit the bag", noLabel:"Just stretching",
      lines:[
        "Throughout heaven and earth, I alone am the strongest… spotter in this gym, anyway.",
        "You wondering if the owner actually does stuff, or just hires cool guys to stand around? Valid question.",
        "So pick: throw hands with the bag, or I pull up the pile of things he's built. You leave impressed regardless."
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
