/* ============================================================
   CONTENT — portfolio data + character dialogue.
   Edit text freely; structure is read by the rest of the app.
   ============================================================ */
import type { Content } from "./core/types";

export const CONTENT: Content = {
  owner: {
    name: "Kerui (Ryan) Huang",
    email: "ryanhuang1234567890@gmail.com",
    phone: "0481971130",
    phoneIntl: "+61481971130",
    phoneDisplay: "0481 971 130",
    linkedin: "https://www.linkedin.com/in/kerui-huang/",
    instagram: "https://www.instagram.com/itsryianx/",
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
      { label: "Leadership", value: "Events Director, UniMelb Game Makers" },
    ],
    skills: ["Python", "Java", "C", "SQL", "JavaScript", "C#", "React", "Node.js", "PostgreSQL", "LangChain", "LangGraph", "RAG", "Git", "Figma"],
  },
  experience: {
    kicker: "Experience",
    title: "Where I've worked",
    items: [
      { company: "Inherity", role: "Software Engineer", logo: "assets/logos/inherity.jpeg", period: "Apr 2026 – Present",
        p: "Built a secure document parser for a fintech platform, automating document extraction and verification to support faster approvals and early access to funds." },
      { company: "Lyra", role: "Forward Deployed Engineer", logo: "assets/logos/lyra.jpeg", period: "Feb 2026 – Present",
        p: "Founding engineer for Silicon Valley startups." },
      { company: "CSIRO", role: "Software Engineer", logo: "assets/logos/csiro.jpeg", period: "Jan 2026 – Mar 2026",
        p: "Built an AI-powered climate projection platform." },
      { company: "Deloitte", role: "Software Engineer", logo: "assets/logos/deloitte.jpeg", period: "Nov 2025 – Dec 2025",
        p: "Digital Workplace (DWP) team." },
      { company: "FSR Smart Consulting", role: "Software Engineer", logo: "assets/logos/fsr.jpeg", period: "Jun 2025 – Nov 2025",
        p: "AI and deepfake detection software." },
    ],
  },
  projects: {
    kicker: "Projects",
    title: "Side Projects",
    lead: "Things I build on my own time, outside of work.",
    items: [
      { h: "Airtable Clone", link: "https://airtable-clone-ryan.vercel.app/", logo: "assets/projects/airtable.png", p: "Airtable clone built with the T3 stack." },
      { h: "Ryloom", link: "https://ryloom-web.vercel.app/", logo: "assets/projects/ryloom.svg", p: "Loom clone — record your screen in the browser or the desktop app, get a shareable link the moment you stop." },
      { h: "Pinochle", link: "https://github.com/MoltoRubato/Pinochle", p: "Desktop card game featuring GUI gameplay and an intelligent computer opponent." },
      { h: "This Website", link: "https://github.com/MoltoRubato/MyWebsite", logo: "assets/projects/mywebsite.png", p: "The interactive pixel-art world you're exploring right now — built with vanilla JavaScript and an HTML5 canvas." },
    ],
  },
  contact: {
    kicker: "Contact",
    title: "Let's talk",
    lead: "Collaborations, opportunities, or just to say hi.",
  },

  // ---- Characters ----
  // room: where each lives. portrait + sprite filenames match assets folders.
  // opens   = header tab a character can pull up ("about"/"experience"/"projects"/"contact").
  // openLabel/actLabel/noLabel = funny choice-button text (game.ts builds the menu).
  characters: {
    Drod: {
      name: "Drod", room: "game", color: "#caa23a",
      opens: "projects", openLabel: "See the experiments",
      actLabel: "Play a game", noLabel: "Maybe later",
      lines: [
        "Ah, another brave soul sent here to be 'humbled.' Apparently that's my entire purpose.",
        "Fun fact: I'm not real. Some guy coded me up over a weekend. I try not to dwell on it.",
        "Anyway. Face me at the board, or go gawk at his other little experiments. I'm exhibit A, by the way.",
      ],
      // Session memory — first match wins, shown once per visit.
      reactions: [
        { flag: "pokerBigWin", lines: ["Word from the card room is you went on a HEATER. The chips are fake, but the dealer's tears? Real."] },
        { flag: "pokerBusted", lines: ["Heard you went bust at the card table. Hey, house money. The house is still laughing though."] },
        { flag: "pressedButton", lines: ["You pressed the big red button, didn't you. Don't bother denying it — I read the logs. Every. Single. Visitor."] },
        { when: (c) => c.num("chessWins") > 0, lines: ["Oh. You're back. About last game — I LET you win. That's my story, Ryan's already heard it, and we're both pretending to believe it."] },
        { when: (c) => c.num("chessLosses") > 0, lines: ["Back for revenge? Adorable. Last time ended in checkmate; this time let's aim for 'respectably close.'"] },
      ],
    },
    Alex: {
      name: "Alex", room: "music", color: "#5fb0c9",
      actLabel: "Tap out a beat", noLabel: "Just vibing",
      lines: [
        "Ayy, you found the studio! Watch the cables, a couple of 'em bite.",
        "The owner? Oh, he basically haunts this room. Pops in for a 'quick break,' leaves at 4am. Every time.",
        "Anyway, enough about the ghost who pays rent. Hop on the booth and let's hear you.",
      ],
      reactions: [
        { when: (c) => c.num("pianoNotes") >= 50, lines: ["I heard you on the piano earlier. {pianoNotes} notes! The owner plays it nightly and calls it 'lo-fi research.' Yours was better. Don't tell him."] },
      ],
    },
    DJ: {
      name: "DJ", room: "music", color: "#b07acb",
      actLabel: "Hop on the pad", noLabel: "Just vibing",
      lines: [
        "Shh. Oh, false alarm, you're cool. Thought you were here about the noise complaint.",
        "Every track in this place got hand-picked by you-know-who. Man has VERY strong opinions about hi-hats.",
        "Enough chitchat. Get on the decks and cook something. I totally won't judge. (I'm judging.)",
      ],
      reactions: [
        { when: (c) => c.trackName !== null, lines: ["Ohhh, '{track}'? Good ears. The owner claims he 'curated' that one. He found it at 3am and got emotional, but sure — curated."] },
        { when: (c) => c.num("beatsDownloaded") > 0, lines: ["Wait, you DOWNLOADED your beat? Respect. The owner's never shipped one of his. It's 'in post.' It's been 'in post' for a year."] },
      ],
    },
    Bob: {
      name: "Bob", room: "lounge", color: "#d98a5a",
      opens: "experience", openLabel: "Show me the rundown", noLabel: "Nah, just resting",
      lines: [
        "Sit, sit. This couch has held fancier people than me, but it'll cope.",
        "Asking about the owner, huh? I've watched a lotta folks pass through this lounge.",
        "That Ryan's worked more places than I've taken naps, and buddy, I nap competitively. Want the rundown?",
      ],
      reactions: [
        { when: (c) => c.has("room_gym") && c.has("room_game") && c.has("room_music"), lines: ["Full lap of the place already? Most folks nap on this couch first. You hustle harder than the owner — don't tell him I said that."] },
      ],
    },
    Dino: {
      name: "Dino", room: "lounge", color: "#69b06a",
      opens: "about", openLabel: "Show me his file", noLabel: "I'll keep snooping",
      lines: [
        "Oh! A real-life person. We mostly get pigeons in here, so honestly this is big.",
        "Word is some guy named 'Ryan' owns this whole place. Never seen him. Little bit sus, if you ask me.",
        "I'm nosy though, so I looked him up. Wanna see what kind of person builds a dinosaur his own lounge?",
      ],
      reactions: [
        { flag: "guestbookSigned", lines: ["You signed the guestbook!! I read it every night before bed. ...Don't make it weird that I just told you that."] },
      ],
    },
    Girl: {
      name: "Amelia", room: "gym", color: "#e58aa6",
      opens: "contact", openLabel: "Grab his contact",
      actLabel: "Re-rack the weights", noLabel: "Just stretching",
      lines: [
        "Spotter's here! Drop the bar on your face and I'll gasp real convincing-like.",
        "Lemme guess: you're after the guy whose name's plastered all over this building?",
        "I'm not his secretary, but his contact's just sorta lying around over here. Don't make it weird.",
      ],
      reactions: [
        { flag: "rackPar", lines: ["Minimum-move re-rack. I told Gojo. He did the 'hm' thing. That's his highest honor."] },
        { when: (c) => c.has("pet_Mimi") && c.has("pet_Batman"), lines: ["Heard you've been petting everything that moves in the lounge. Mimi rates you. Batman is 'reserving judgment,' which is cat for obsessed."] },
      ],
    },
    Gojo: {
      name: "Gojo", room: "gym", color: "#7aa0e5",
      opens: "projects", openLabel: "Show me his builds", openIcon: "hammer",
      actLabel: "Hit the bag", noLabel: "Just stretching",
      lines: [
        "Throughout heaven and earth, I alone am the strongest… spotter in this gym, anyway.",
        "You wondering if the owner actually does stuff, or just hires cool guys to stand around? Valid question.",
        "So pick: throw hands with the bag, or I pull up the pile of things he's built. You leave impressed regardless.",
      ],
      reactions: [
        { when: (c) => c.num("gymBest") > 0, lines: ["{gymBest} points on the bag. Not bad. For reference, the owner once pulled a muscle reaching for his mouse, so the bar here is underground."] },
      ],
    },
  },

  // Jukebox tracks — lo-fi pack. Playing one sets the whole site's background
  // music (keeps going after the jukebox window closes). Order is a loose
  // "day into night" vibe arc, ending on the chiptune cuts.
  tracks: [
    { name: "Coffee", file: "assets/audio/Coffee.mp3" },
    { name: "Cozy", file: "assets/audio/Cozy.mp3" },
    { name: "Chill", file: "assets/audio/Chill.mp3" },
    { name: "Rainy", file: "assets/audio/Rainy.mp3" },
    { name: "Cabin", file: "assets/audio/Cabin.mp3" },
    { name: "Garden", file: "assets/audio/Garden.mp3" },
    { name: "Stroll", file: "assets/audio/Stroll.mp3" },
    { name: "Drive", file: "assets/audio/Drive.mp3" },
    { name: "Sunset", file: "assets/audio/Sunset.mp3" },
    { name: "Night", file: "assets/audio/Night.mp3" },
    { name: "Midnight", file: "assets/audio/Midnight.mp3" },
    { name: "Serenity", file: "assets/audio/Serenity.mp3" },
    { name: "Zen", file: "assets/audio/Zen.mp3" },
    { name: "Ambience", file: "assets/audio/Ambience.mp3" },
    { name: "Underwater", file: "assets/audio/Underwater.mp3" },
    { name: "Vibe", file: "assets/audio/Vibe.mp3" },
    { name: "Pixel", file: "assets/audio/Pixel.mp3" },
    { name: "Chiptune", file: "assets/audio/Chiptune.mp3" },
  ],
};
