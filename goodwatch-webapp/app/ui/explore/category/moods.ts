import type { PageData } from "~/ui/explore/config"

export const moods: Record<string, PageData> = {
	scary: {
		type: "all",
		label: "Scary 👻",
		path: "scary",
		subtitle: "Chills Down Your Spine",
		description:
			"Heart-pounding moments that'll make you check the locks twice. From jump scares that hit like espresso shots to lingering dread that sticks around like uninvited guests.",
		backdrop_path: "qtWjZgCmslPwjP4DFUcLBUj13GV.jpg",
		discoverParams: {
			similarDNA:
				"307964_Target+Audience|Horror+Enthusiasts+%28Scary+Screams%29,309526_Mood|Haunting+%28Scary+Whispers%29,307934_Mood|Scary",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes something 'scary' versus regular horror?",
				a: "We focus on content where tension never lets up - stories that get under your skin through atmosphere and anticipation, not just gore. Think creeping dread rather than shock value.",
			},
			{
				q: "Are there different types of scares?",
				a: "Absolutely! Some stories build fear through unknown threats, others through psychological manipulation. We include everything from paranormal chills to real-world terrors.",
			},
		],
	},
	"feel-good": {
		type: "all",
		label: "Feel Good ❤",
		path: "feel-good",
		subtitle: "Warmth and Smiles",
		description:
			"Stories that hug your soul. Expect underdog victories, friendship goals, and happy endings so sweet they should come with a dentist warning.",
		backdrop_path: "i9zpVfvLYJpoenHkklveIR07Em5.jpg",
		discoverParams: {
			similarDNA:
				"313752_Mood|Feel-Good,86269_Mood|Joyful,307865_Mood|Heartwarming",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines a feel-good story?",
				a: "Core themes of hope and human connection. These are tales where kindness wins, personal growth happens, and the world feels a little brighter by the end.",
			},
			{
				q: "Do these avoid all conflict?",
				a: "Not at all! The best feel-good stories earn their warmth by overcoming real challenges - they just focus on resilience rather than cynicism.",
			},
		],
	},
	suspense: {
		type: "all",
		label: "Suspense ⏳",
		path: "suspense",
		subtitle: "Nerve-Tingling Tension",
		description:
			"Clock's ticking, traps are set, and every shadow could change everything. These stories grab you by the collar and don't let go.",
		backdrop_path: "kZGaVeXSkkvrpMYvD97sxHj291k.jpg",
		discoverParams: {
			similarDNA:
				"298969_Sub-Genres|Suspense,308236_Pacing|Increasing+Suspense",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "How is suspense different from action?",
				a: "It's all about the buildup - suspense makes you lean forward wondering what's next, while action delivers constant payoffs. The best stories balance both.",
			},
			{
				q: "What creates good suspense?",
				a: "High stakes with personal consequences. Whether it's a bomb defusal or a family secret, you need to truly care about what happens next.",
			},
		],
	},
	motivational: {
		type: "all",
		label: "Motivational 💪",
		path: "motivational",
		subtitle: "Rise to the Challenge",
		description:
			"Against-all-odds victories, personal bests smashed, and heroes who redefine 'possible'. Warning: May inspire sudden life changes.",
		backdrop_path: "8OGGM7clS3CN4n2pTEZs6tRll4n.jpg",
		discoverParams: {
			similarDNA:
				"309829_Dialog|Motivational+Speeches,5848336_Dialog|Motivational+Instructions,69527_Score+and+Sound|Motivational+Themes,5848335_Plot|Motivational+Guidance",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes a story truly motivational?",
				a: "Authentic struggles rather than easy wins. We highlight stories where effort and perseverance matter more than natural talent or luck.",
			},
			{
				q: "Are these all sports stories?",
				a: "Not at all! While we include athletic triumphs, we also feature artistic breakthroughs, scientific discoveries, and everyday people doing extraordinary things.",
			},
		],
	},
	funny: {
		type: "all",
		label: "Funny 😂",
		path: "funny",
		subtitle: "Laughter Guaranteed",
		description:
			"From dad joke disasters to sarcastic comebacks that deserve applause. These aren't just jokes - they're survival skills for life's awkwardest moments.",
		backdrop_path: "8tZ90NxuoXjkHXELFOcnZDRr63G.jpg",
		discoverParams: {
			similarDNA:
				"275087_Mood|Funny,307872_Humor|Situational+Comedy,307874_Humor|Slapstick,307884_Sub-Genres|Buddy+Comedy,312780_Sub-Genres|Teen+Comedy",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes humor universal?",
				a: "It's all about timing and relatability. We curate stories where comedy arises from authentic human experiences - the messier, the better.",
			},
			{
				q: "How do you handle different humor styles?",
				a: "From witty banter to physical comedy, our picks celebrate diverse approaches. The common thread? Laughter that feels earned rather than forced.",
			},
		],
	},
	psychological: {
		type: "all",
		label: "Psychological 🧠",
		path: "psychological",
		subtitle: "Mind Over Matter",
		description:
			"Reality-bending narratives, unreliable narrators, and twists that'll leave you questioning everything. Consider this a workout for your brain.",
		backdrop_path: "p1PLSI5Nw2krGxD7X4ulul1tDAk.jpg",
		discoverParams: {
			similarDNA:
				"308075_Sub-Genres|Psychological+Thriller,292610_Plot|Psychological+Manipulation,307929_Themes|The+Human+Condition,308577_Plot|Mind+Games,275946_Pacing|Twisting",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines psychological storytelling?",
				a: "Focus on internal rather than external conflicts. These stories explore how characters perceive reality, often blurring lines between truth and delusion.",
			},
			{
				q: "Are these stories always dark?",
				a: "While many explore complex themes, some use psychological elements for clever puzzles or fascinating character studies. The mind itself is the main antagonist.",
			},
		],
	},
}
