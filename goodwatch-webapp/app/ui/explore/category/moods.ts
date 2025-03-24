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
			withGenres: "27",
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
				"36380351_Mood|Feel-Good,36377413_Mood|Joyful,36373018_Mood|Heartwarming",
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
				"36373373_Pacing|Building+Suspense,36374361_Pacing|Increasing+Suspense,36377765_Sub-Genres|Suspense",
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
				"36381420_Dialog|Motivational+Speeches,36697700_Dialog|Motivational+Instructions,40141891_Dialog|Motivational+Rhetoric,40083275_Cultural+Impact|Motivational+Story",
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
				"36373052_Mood|Funny,36373061_Humor|Situational+Comedy,36373062_Humor|Slapstick,36373520_Sub-Genres|Buddy+Comedy,36377772_Sub-Genres|Teen+Comedy",
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
				"36373403_Sub-Genres|Psychological+Thriller,36374366_Plot|Psychological+Manipulation,36378034_Plot|Mind+Games,36373072_Pacing|Twisting,36399617_Character+Types|Psychopath",
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
	nostalgic: {
		type: "all",
		label: "Nostalgic 🎞",
		path: "nostalgic",
		subtitle: "Remembering the Good Times",
		description:
			"Films that transport you back with warm memories and a reflective vibe.",
		backdrop_path: "rhy8pbeNdfUGX5DkR0Zv1zswP2d.jpg",
		discoverParams: {
			minYear: "1900",
			maxYear: "2000",
			similarDNA:
				"36373019_Mood|Nostalgic,36383303_Themes|Nostalgia,36386515_Themes|The+Power+Of+Nostalgia,36408837_Plot|Hometown+Nostalgia,36471681_Place|Nostalgic+Locations",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes a movie nostalgic?",
				a: "It evokes the past with warmth and a hint of longing.",
			},
		],
	},
	melancholic: {
		type: "all",
		label: "Melancholic 🌧",
		path: "melancholic",
		subtitle: "Somber & Reflective",
		description:
			"Films that stir deep emotions with a mix of beauty and sorrow.",
		backdrop_path: "fAuXblS0qUiQ2SWJzpvFMH1su6i.jpg",
		discoverParams: {
			similarDNA: "36372984_Mood|Melancholic",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines a melancholic film?",
				a: "It blends sadness and beauty, inviting introspection.",
			},
		],
	},
	bittersweet: {
		type: "all",
		label: "Bittersweet 🍂",
		path: "bittersweet",
		subtitle: "Joy with a Touch of Sorrow",
		description:
			"Stories where happy moments mix with the sting of loss, echoing real life.",
		backdrop_path: "zZRXGoHo5TeUD0L1LqYIJjlPvJC.jpg",
		discoverParams: {
			similarDNA:
				"36416556_Plot|Bittersweet+Memories,36373460_Mood|Bittersweet",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "Why opt for bittersweet?",
				a: "It mirrors life—joy and pain often go hand in hand.",
			},
		],
	},
	whimsical: {
		type: "all",
		label: "Whimsical ✨",
		path: "whimsical",
		subtitle: "Playful & Dreamlike",
		description:
			"Lighthearted films that embrace the quirky and imaginative side of life.",
		backdrop_path: "dfQtPf0lw9C1MWYFMJseM5RZI6P.jpg",
		discoverParams: {
			similarDNA: "36373054_Mood|Whimsical,36388861_Mood|Dreamy",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What makes a film whimsical?",
				a: "It charms with playful twists and unexpected magic.",
			},
		],
	},
	peaceful: {
		type: "all",
		label: "Peaceful 🌿",
		path: "peaceful",
		subtitle: "Calm & Serene",
		description:
			"Films that offer a quiet, soothing escape for reflection and relaxation.",
		backdrop_path: "syfmYmITnWPJU3hhaP0ckny5hMN.jpg",
		discoverParams: {
			similarDNA: "36383932_Mood|Quiet,36442062_Mood|Calm",
			similarDNACombinationType: "any",
		},
		faq: [
			{
				q: "What defines a peaceful film?",
				a: "A calming atmosphere that helps you unwind and find balance.",
			},
		],
	},
}
