import type { PageData } from "~/ui/explore/config"

// TODO
// posters:
// https://image.tmdb.org/t/p/w185/4rBObJFpiWJOG7aIlRrOUniAkBs.jpg

export const genres: Record<string, PageData> = {
	"action-and-adventure": {
		type: "tv-shows",
		label: "Action & Adventure",
		path: "action-and-adventure",
		subtitle: "Explosions, Chases, and Zero Chill",
		description:
			"TV shows that skip the small talk. Expect rooftop sprints, last-second escapes, and villains who really should’ve stayed in bed. Perfect for nights when you just want things to blow up.",
		backdrop_path: "stHcCE5mQIzDDgFVxZZ0UfD0hIh.jpg",
		discoverParams: { withGenres: "10759" },
		faq: [
			{
				q: "What counts as Action & Adventure TV?",
				a: "If it's got car chases through crowded markets or heroes dangling from helicopters, it's here. We track TMDB's most-watched shows where every episode feels like a finale cliffhanger.",
			},
			{
				q: "Any shows good for action newbies?",
				a: "Absolutely! Our algorithm surfaces both gateway series and hardcore fan favorites. Look for 'Trending Now' titles to start with crowd-pleasers.",
			},
		],
	},
	action: {
		type: "movies",
		label: "Action",
		path: "action",
		subtitle: "Guns, Grit, and Glory",
		description:
			"Need a fix of fistfights, car-flips, and villains who *really* shouldn’t have picked a fight? This list’s got your back. We’re talking renegade spies with a grudge, heists gone sideways, and heroes who reload sarcasm faster than their clips. Your couch just became a warzone.",
		backdrop_path: "61OgYuMIn6bbbxYKYaginYBE7cu.jpg",
		discoverParams: { withGenres: "28" },
		faq: [
			{
				q: "What's considered a great action movie?",
				a: "We prioritize TMDB's highest-rated films where stakes stay high and the adrenaline never dips - think practical stunts, memorable villains, and heroes you actually root for.",
			},
			{
				q: "Can I find classic 80s/90s action here?",
				a: "You bet. Our list mixes new blockbusters with vintage gems. Sort by 'Release Date' to travel through action cinema history.",
			},
		],
	},
	adventure: {
		type: "movies",
		label: "Adventure",
		path: "adventure",
		subtitle: "Treasure Hunts & Wild Rides",
		description:
			"Movies that drag you through jungles, across deserts, and into ancient ruins. Heroes here don’t read warning signs – they jump first, ask questions later. Bring snacks: you’re in for the long haul.",
		backdrop_path: "iZvSazhTTS3VpYKMxLRcXovdzS6.jpg",
		discoverParams: { withGenres: "12" },
		faq: [
			{
				q: "What's the difference between Action and Adventure?",
				a: "Adventure focuses on the journey - think quests and exploration. Action prioritizes combat/chases. Many films blend both, which is why we love 'em!",
			},
			{
				q: "Any family-friendly adventure movies?",
				a: "Plenty! Use the 'Family-Friendly' filter to find PG-rated quests perfect for shared viewing.",
			},
		],
	},
	animation: {
		type: "all",
		label: "Animation",
		path: "animation",
		subtitle: "Worlds Beyond Reality",
		description:
			"From heartwarming tales to raccoon thieves stealing the moon. Whether you’re 8 or 80, these stories prove animation isn’t just cartoons – it’s magic you can watch.",
		backdrop_path: "j29ekbcLpBvxnGk6LjdTc2EI5SA.jpg",
		discoverParams: { withGenres: "16" },
		faq: [
			{
				q: "Are these just kids' cartoons?",
				a: "Not at all! Our list includes Oscar-winning films and adult-focused stories. Filter by 'Mature Themes' for complex narratives.",
			},
			{
				q: "What animation styles are included?",
				a: "Everything from hand-drawn classics to cutting-edge CGI. Look for tags like 'Stop-Motion Magic' or 'Anime Essentials'.",
			},
		],
	},
	comedy: {
		type: "all",
		label: "Comedy",
		path: "comedy",
		subtitle: "Laughs That Stick",
		description:
			"Awkward dates, workplace disasters, and heroes who win by accident. These aren’t just jokes – they’re survival guides for life’s weirdest moments. Watch with friends (and maybe a clean shirt).",
		backdrop_path: "bQlw59HncOXX9alFlOYKHAvSnm.jpg",
		discoverParams: { withGenres: "35" },
		faq: [
			{
				q: "What comedy styles are featured?",
				a: "From slapstick to dark humor, we track TMDB's top-rated laughs. Filter by 'Satire', 'Rom-Com', or 'Stand-Up Specials' to find your flavor.",
			},
			{
				q: "Any comedies that aren't just dumb jokes?",
				a: "Absolutely. Look for 'Smart Comedy' tags for witty dialogue and humor that makes you think while you laugh.",
			},
		],
	},
	crime: {
		type: "all",
		label: "Crime",
		path: "crime",
		subtitle: "Bad Plans, Big Drama",
		description:
			"Mafia meltdowns, bank jobs gone wrong, and detectives who play dirty. These stories make your worst life choices look tame. Pro tip: Don’t try this at home.",
		backdrop_path: "q3Rgy4pQlPBou8ilYaVdHmjylyV.jpg",
		discoverParams: { withGenres: "80" },
		faq: [
			{
				q: "Are these crime stories based on real events?",
				a: "Some are! Look for 'True Crime' tags based on TMDB data. We include both documentaries and fictionalized versions.",
			},
			{
				q: "What's the difference between Crime and Thriller?",
				a: "Crime focuses on lawbreakers' perspectives, while Thrillers emphasize suspense. Many films blend both - try our 'Hybrid' filter!",
			},
		],
	},
	documentary: {
		type: "all",
		label: "Documentary",
		path: "documentary",
		subtitle: "Real Life, Raw Stories",
		description:
			"Shark whisperers, cult survivors, and inventors chasing impossible dreams. Truth isn’t just stranger than fiction here – it’s more gripping.",
		discoverParams: { withGenres: "99" },
		backdrop_path: "3TOUvY2NZx8r31UHA3CQdRAY271.jpg",
		faq: [
			{
				q: "Are these documentaries neutral or opinionated?",
				a: "We include all perspectives! TMDB's top-rated docs range from investigative journalism to passionate advocacy films.",
			},
			{
				q: "Any short documentaries under 60 minutes?",
				a: "Yes! Use the 'Quick Watch' filter to find impactful stories perfect for a lunch break.",
			},
		],
	},
	drama: {
		type: "all",
		label: "Drama",
		path: "drama",
		subtitle: "Feelings First",
		description:
			"Family feuds, quiet triumphs, and love stories that hurt so good. These aren’t just movies – they’re life turned up to 11. Keep tissues close.",
		discoverParams: { withGenres: "18" },
		backdrop_path: "4Bb1kMIfrT2tYRZ9M6Jhqy6gkeF.jpg",
		faq: [
			{
				q: "What makes a movie a drama?",
				a: "Emotional depth and character-driven stories. We feature TMDB's highest-rated films where the stakes feel personal and real.",
			},
			{
				q: "Are these dramas all sad/serious?",
				a: "Not at all! Filter by 'Uplifting' for hopeful stories or 'Tearjerker' when you need a good cry. We've got the full spectrum.",
			},
		],
	},
	family: {
		type: "all",
		label: "Family",
		path: "family",
		subtitle: "Fun for All Ages",
		description:
			"Talking pets, backyard adventures, and lessons that don’t feel like homework. Perfect for when you need something everyone from grandma to the kids will actually agree on.",
		discoverParams: { withGenres: "10751" },
		backdrop_path: "h3uqFk7sZRJvLZDdLiFB9qwbL07.jpg",
		faq: [
			{
				q: "What age group are these movies for?",
				a: "All ages! Our algorithm prioritizes films that entertain kids while keeping adults engaged. Check age ratings for perfect matches.",
			},
			{
				q: "Any modern family movie recommendations?",
				a: "We automatically surface both new releases and timeless classics. Sort by 'Newest' for fresh picks the whole crew will love.",
			},
		],
	},
	fantasy: {
		type: "movies",
		label: "Fantasy",
		path: "fantasy",
		subtitle: "Magic Required",
		description:
			"Wizards with attitude, quests for cursed artifacts, and kingdoms where nobody does paperwork. Leave logic at the door – this is where fun lives.",
		discoverParams: { withGenres: "14" },
		backdrop_path: "jdleZMBQOj93qoGVNCNbCZxGxdH.jpg",
		faq: [
			{
				q: "What's the difference between Fantasy and Sci-Fi?",
				a: "Fantasy embraces magic/mythology over science. Here you'll find dragons, not robots - unless they're steam-powered clockwork dragons!",
			},
			{
				q: "Any fantasy movies based on games?",
				a: "Yes! Search 'Game Adaptations' for films inspired by RPGs, card games, and video game lore.",
			},
		],
	},
	history: {
		type: "movies",
		label: "History",
		path: "history",
		subtitle: "Past Comes Alive",
		description:
			"Kings, rebels, and ordinary folks who changed everything. These films make textbooks look boring – here, history has dirt under its nails.",
		discoverParams: { withGenres: "36" },
		backdrop_path: "ycnO0cjsAROSGJKuMODgRtWsHQw.jpg",
		faq: [
			{
				q: "How historically accurate are these movies?",
				a: "Varies by film! Look for 'Fact-Based' tags for meticulous recreations, or 'Historical Fiction' for dramatic interpretations.",
			},
			{
				q: "Any hidden gem history films?",
				a: "Absolutely! Our algorithm surfaces underrated stories about forgotten events and unsung heroes.",
			},
		],
	},
	horror: {
		type: "movies",
		label: "Horror",
		path: "horror",
		subtitle: "Sleep Optional",
		description:
			"Creepy dolls, haunted hotels, and monsters that don’t follow rules. Watch with lights on, doors locked, and maybe a friend who screams quieter than you.",
		discoverParams: { withGenres: "27" },
		backdrop_path: "6DultsthBFLCFdDoWYVjIRJZotk.jpg",
		faq: [
			{
				q: "How scary are these horror movies?",
				a: "From creepy fun to nightmare fuel! Check 'Fear Level' tags to find your comfort zone. When in doubt, watch daylight hours.",
			},
			{
				q: "Any horror-comedy mixes?",
				a: "Yes! Search 'Horror-Comedy' for films that make you laugh between screams. Perfect for scaredy-cats building tolerance.",
			},
		],
	},
	kids: {
		type: "tv-shows",
		label: "Kids",
		path: "kids",
		subtitle: "Adventures Start Here",
		description:
			"Talking animals, rainbow unicorns, and heroes who are still learning to tie their shoes. The perfect mix of silly and sweet for tomorrow’s binge-watchers.",
		discoverParams: { withGenres: "10762" },
		backdrop_path: "7xBlLn0iSwAbH3MNVdHZoG8kMFG.jpg",
		faq: [
			{
				q: "What age group is this content for?",
				a: "Primarily 2-12 years, but we include family-friendly shows parents enjoy too. Filter by age range for perfect matches.",
			},
			{
				q: "Are these shows educational?",
				a: "Many are! Look for 'Learning' tags that mix fun with science, history, or social skills.",
			},
		],
	},
	music: {
		type: "movies",
		label: "Music",
		path: "music",
		subtitle: "Beats That Move You",
		description:
			"Rising stars, legendary tours, and garage bands chasing their big break. Turn it up – these stories deserve surround sound.",
		discoverParams: { withGenres: "10402" },
		backdrop_path: "9441r6izIG2t46C2W1XoKYVN1o.jpg",
		faq: [
			{
				q: "Are these biopics or fictional stories?",
				a: "Both! We feature TMDB's top music films - filter by 'Based on Real Artists' or 'Original Soundtracks'.",
			},
			{
				q: "Any concert films included?",
				a: "Absolutely! Search 'Live Performances' for iconic shows and festival documentaries.",
			},
		],
	},
	mystery: {
		type: "all",
		label: "Mystery",
		path: "mystery",
		subtitle: "Secrets Waiting to Crack",
		description:
			"Missing heirlooms, small towns with big lies, and detectives who notice everything. Watch closely – the answer’s always in the details.",
		discoverParams: { withGenres: "9648" },
		backdrop_path: "dQF17lG4OZ3pC4QD9iNjaMS96gO.jpg",
		faq: [
			{
				q: "What's the difference between Mystery and Thriller?",
				a: "Mysteries focus on solving puzzles, Thrillers on suspense/danger. Many films blend both - try our 'Hybrid' filter!",
			},
			{
				q: "Any classic whodunits?",
				a: "Plenty! Sort by 'Vintage' for Agatha Christie-style mysteries or 'Modern' for twisty new takes.",
			},
		],
	},
	news: {
		type: "tv-shows",
		label: "News",
		path: "news",
		subtitle: "The World Unfiltered",
		description:
			"Deep dives, breaking stories, and interviews that don’t hold back. For when you want facts straight from the source.",
		discoverParams: { withGenres: "10763" },
		backdrop_path: "rgJaDVbOIboShiCDJXobYuQJRDp.jpg",
		faq: [
			{
				q: "Are these live news or documentaries?",
				a: "We focus on in-depth news analysis and documentary series rather than 24/7 live coverage.",
			},
			{
				q: "How current is the content?",
				a: "Our algorithm prioritizes recent investigations but includes essential classics too. Sort by 'Newest' for fresh reports.",
			},
		],
	},
	reality: {
		type: "tv-shows",
		label: "Reality",
		path: "reality",
		subtitle: "Drama Without a Script",
		description:
			"Kitchen disasters, dating fails, and talent shows where anything can happen. Unfiltered, unscripted, and way too addictive.",
		discoverParams: { withGenres: "10764" },
		backdrop_path: "hnGWafrtUTqQgCTyIAcsAIaYmmZ.jpg",
		faq: [
			{
				q: "How real is reality TV?",
				a: "We let you decide! Our list includes everything from raw documentaries to over-the-top competition shows.",
			},
			{
				q: "Any reality shows for foodies?",
				a: "Absolutely! Search 'Cooking' for kitchen showdowns and restaurant makeovers that'll make you hungry.",
			},
		],
	},
	romance: {
		type: "movies",
		label: "Romance",
		path: "romance",
		subtitle: "Love, Unedited",
		description:
			"Meet-cutes, slow burns, and grand gestures that’d get you arrested in real life. Perfect for when you want butterflies without the awkward texting.",
		discoverParams: { withGenres: "10749" },
		backdrop_path: "hLCw7tsYOkWDisEZl6waoEAbI8V.jpg",
		faq: [
			{
				q: "Are these all cheesy rom-coms?",
				a: "Nope! We feature TMDB's top-rated love stories - filter by 'Realistic' for messy relationships or 'Fantasy' for fairytale escapes.",
			},
			{
				q: "Any LGBTQ+ romance films?",
				a: "Yes! Search 'Queer Romance' for heartfelt stories across the spectrum of love.",
			},
		],
	},
	"scifi-and-fantasy": {
		type: "tv-shows",
		label: "Sci-Fi & Fantasy",
		path: "scifi-and-fantasy",
		subtitle: "Beyond Possible",
		description:
			"Time travelers fixing mistakes, dragons who hate small talk, and planets where the rules don’t apply. Your escape from ordinary starts here.",
		discoverParams: { withGenres: "10765" },
		backdrop_path: "zAdomwa8FtBBr7RsUw6ghtfcBq1.jpg",
		faq: [
			{
				q: "What's the sci-fi/fantasy difference?",
				a: "Sci-fi imagines tech-driven futures, fantasy builds magical worlds. Our list celebrates both - filter by 'Spaceships' or 'Swords & Sorcery'.",
			},
			{
				q: "Any shows based on book series?",
				a: "Many! Look for 'Book Adaptations' tags to continue your favorite literary adventures on screen.",
			},
		],
	},
	"science-fiction": {
		type: "movies",
		label: "Science Fiction",
		path: "science-fiction",
		subtitle: "Future Shock",
		description:
			"AI rebellions, space colonies gone wrong, and tech that’s way too smart for its own good. These aren’t predictions – they’re warnings with killer special effects.",
		discoverParams: { withGenres: "878" },
		backdrop_path: "wPoAoC7aEQiK8QNpQK2Z9G87qrm.jpg",
		faq: [
			{
				q: "What defines a sci-fi movie?",
				a: "Stories grounded in scientific possibilities - even if they're extreme. We feature TMDB's top-rated films that make you think 'Could this happen?'",
			},
			{
				q: "Any classic sci-fi films?",
				a: "Absolutely! Sort by 'Vintage' for groundbreaking 70s/80s films that shaped the genre.",
			},
		],
	},
	soap: {
		type: "tv-shows",
		label: "Soap",
		path: "soap",
		subtitle: "Drama on Tap",
		description:
			"Secret twins, boardroom backstabs, and love triangles that’d break a geometry teacher. Perfect for when real-life gossip isn’t juicy enough.",
		discoverParams: { withGenres: "10766" },
		backdrop_path: "c71SotbCKzBkuOGxKPi2C18ytmm.jpg",
		faq: [
			{
				q: "Are these daytime soap operas?",
				a: "We include both classic daytime dramas and primetime soapy series. Filter by 'Guilty Pleasure' for maximum melodrama.",
			},
			{
				q: "Any soaps good for beginners?",
				a: "Look for 'Standalone Seasons' - self-contained stories that don't require years of backstory knowledge.",
			},
		],
	},
	talk: {
		type: "tv-shows",
		label: "Talk Shows",
		path: "talk",
		subtitle: "Conversations That Pop",
		description:
			"Celebrity confessions, hot takes that spark debates, and interviews where the real tea gets spilled. Like eavesdropping, but legal.",
		discoverParams: { withGenres: "10767" },
		backdrop_path: "48I7PO8e6thSx6mZN3e5Hm9jBpb.jpg",
		faq: [
			{
				q: "Are these political shows or celebrity interviews?",
				a: "Both! We feature TMDB's top-rated talk shows - filter by 'Celebrity Chat' or 'Hard News' to match your mood.",
			},
			{
				q: "Any iconic talk show episodes?",
				a: "Absolutely! Sort by 'Most Popular' for legendary interviews and viral moments.",
			},
		],
	},
	thriller: {
		type: "movies",
		label: "Thriller",
		path: "thriller",
		subtitle: "Edge of Your Seat",
		description:
			"Whodunits where everyone’s lying, conspiracies that hit too close, and chases where second place isn’t an option. Watch once for the rush, twice to spot the clues.",
		discoverParams: { withGenres: "53" },
		backdrop_path: "suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
		faq: [
			{
				q: "What makes a thriller different from horror?",
				a: "Thrillers focus on suspense over scares. You'll find more psychological tension here than monsters - unless the monster is human...",
			},
			{
				q: "Any thriller movies with twist endings?",
				a: "So many! Look for 'Mind-Bender' tags - just avoid spoilers at all costs.",
			},
		],
	},
	"tv-movie": {
		type: "movies",
		label: "TV Movie",
		path: "tv-movie",
		subtitle: "Big Stories, Small Screen",
		description:
			"Small-town romances, true crime twists, and holiday miracles that fit right between dinner and bedtime. Comfort viewing at its best.",
		discoverParams: { withGenres: "10770" },
		backdrop_path: "y5J83NGatx6SpskBhSqYi1yvyR7.jpg",
		faq: [
			{
				q: "What's a TV movie exactly?",
				a: "Films made specifically for TV rather than theaters. They often feature familiar tropes and cozy storytelling perfect for relaxed viewing.",
			},
			{
				q: "Any TV movies based on books?",
				a: "Many! Look for 'Book Adaptations' tags - perfect for when you want the story without the reading time.",
			},
		],
	},
	"war-and-politics": {
		type: "tv-shows",
		label: "War & Politics",
		path: "war-and-politics",
		subtitle: "Power Plays and Battlefields",
		description:
			"Generals making tough calls, politicians playing dirty, and soldiers just trying to get home. History’s messy – these shows don’t clean it up.",
		discoverParams: { withGenres: "10768" },
		backdrop_path: "2LblVjPKk6XnW6xNdM3KksZQ8U1.jpg",
		faq: [
			{
				q: "Are these documentaries or dramas?",
				a: "Both! We include scripted political thrillers and documentary series exploring real conflicts.",
			},
			{
				q: "Any shows about modern politics?",
				a: "Yes! Sort by 'Current Affairs' for series exploring recent elections, scandals, and global crises.",
			},
		],
	},
	war: {
		type: "movies",
		label: "War",
		path: "war",
		subtitle: "Courage Under Fire",
		description:
			"Brotherhood forged in trenches, impossible rescues, and leaders who carry the weight. These films don’t glorify war – they show what it really costs.",
		discoverParams: { withGenres: "10752" },
		backdrop_path: "6O0lsCK90jZCyPvyYSt8Szzlnd6.jpg",
		faq: [
			{
				q: "Are these all violent combat films?",
				a: "While many show battlefield realities, we also include homefront dramas and POW survival stories. Check content warnings where available.",
			},
			{
				q: "Any anti-war movies included?",
				a: "Absolutely. Look for 'Pacifist Perspective' tags for films questioning the human cost of conflict.",
			},
		],
	},
	western: {
		type: "all",
		label: "Western",
		path: "western",
		subtitle: "Dust and Destiny",
		description:
			"Outlaws with grudges, sheriffs walking the line, and towns where trouble rolls in faster than tumbleweeds. Saddle up – the frontier’s calling.",
		discoverParams: { withGenres: "37" },
		backdrop_path: "kvexLqnJKZSMEu2CWNzNjlcMCNJ.jpg",
		faq: [
			{
				q: "Are these classic or modern westerns?",
				a: "Both! Our list includes everything from John Wayne classics to gritty neo-westerns. Filter by era to find your vibe.",
			},
			{
				q: "Any westerns with diverse leads?",
				a: "Yes! Search 'Modern Perspectives' for films reimagining the genre with Native American, Black, and female protagonists.",
			},
		],
	},
}
