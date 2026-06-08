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
