// PROTOTYPE - throwaway. Real art for the sample titles of the TV flow prototype: TMDB poster and backdrop paths,
// looked up once by title and year (2026-10-12) and hard-coded, so the prototype needs no key. The images load from
// image.tmdb.org, as the app's own posters do.
import type { Title } from "~/ui/prototype-tv-flow/data"

const ART: Record<string, { poster: string; backdrop: string }> = {
	"severance": { poster: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", backdrop: "/ixgFmf1X59PUZam2qbAfskx2gQr.jpg" },
	"knives-out": { poster: "/pThyQovXQrw2m0s9x82twj48Jq4.jpg", backdrop: "/4HWAQu28e2yaWrtupFPGFkdNU7V.jpg" },
	"arrival": { poster: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", backdrop: "/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg" },
	"paddington-2": { poster: "/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg", backdrop: "/iJgNOTSBNrC90U2xyYq9ln0b35o.jpg" },
	"the-bear": { poster: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg", backdrop: "/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg" },
	"oceans-eleven": { poster: "/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg", backdrop: "/ncoqdHs1poUaBqyKic9YI8ai7MP.jpg" },
	"ted-lasso": { poster: "/uRHsiw1wLxPHFXkkv4Ix1s0O6f4.jpg", backdrop: "/nE94ejEbzNCU48bW1oju0dqBONz.jpg" },
	"palm-springs": { poster: "/gnAfqiV7yO3Jq9IntTmwkcaICqc.jpg", backdrop: "/d7JUXVvjvVCXWs1mlpyO5ESdWdT.jpg" },
	"russian-doll": { poster: "/1ju4vQ1EwlIkQxEgWiYmxOs3iBG.jpg", backdrop: "/5TgMzFqbOEcEo99uhIo8DmiENOx.jpg" },
	"only-murders": { poster: "/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg", backdrop: "/WCnEPf4ZNPjszndmrFlDxZ5Uvd.jpg" },
	"interstellar": { poster: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", backdrop: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg" },
	"logan-lucky": { poster: "/mQrhrBaaHvRfBQq0Px3HtVbH9iE.jpg", backdrop: "/eszmHIWJHAKdnJcE3KcvVzOb6Jd.jpg" },
	"slow-horses": { poster: "/AdYr4DjOgXvDUMwu6vEhZy1Rnxk.jpg", backdrop: "/gPQppUnLx9vqPDLz3WwZ2HJsNbt.jpg" },
	"the-martian": { poster: "/5BHuvQ6p9kfc091Z8RiFNhCwL4b.jpg", backdrop: "/lzMS0CI3FLQYC5EgJoWeIaEt0lm.jpg" },
	"broadchurch": { poster: "/2NhBFUTg5KVBmGwafxtLwVdsqrr.jpg", backdrop: "/9CkwC4rou9468XMLTXaB6bZ0frx.jpg" },
	"edge-of-tomorrow": { poster: "/nBM9MMa2WCwvMG4IJ3eiGUdbPe6.jpg", backdrop: "/4V1yIoAKPMRQwGBaSses8Bp2nsi.jpg" },
	"spirited-away": { poster: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", backdrop: "/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg" },
	"baby-driver": { poster: "/tYzFuYXmT8LOYASlFCkaPiAFAl0.jpg", backdrop: "/yir5430WblZSZuIMd9C6pIZerfA.jpg" },
	"andor": { poster: "/khZqmwHQicTYoS7Flreb9EddFZC.jpg", backdrop: "/quCeAmVQHfsdcYkicbxZWVauCVb.jpg" },
	"groundhog-day": { poster: "/gCgt1WARPZaXnq523ySQEUKinCs.jpg", backdrop: "/4W6RYDNe4OByNryOCvJprrutm9h.jpg" },
	"gilmore-girls": { poster: "/gwtzCwU2wdLLf8oejQu2TINiWfQ.jpg", backdrop: "/8U2ndZrneigI2zkvGuTJtt1ZsxK.jpg" },
	"the-office": { poster: "/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg", backdrop: "/mLyW3UTgi2lsMdtueYODcfAB9Ku.jpg" },
	"the-good-place": { poster: "/qIhsuhoIYR5yTnDta0IL4senbeN.jpg", backdrop: "/tZmlWeFEMvxrjJhBJJcLNXpSRiG.jpg" },
	"inside-man": { poster: "/ffMUgkDZICNiyaws1Jkv8qG8uFW.jpg", backdrop: "/tOkSenL74N23O4S7wjJSUHz7Aeh.jpg" },
	"glass-onion": { poster: "/vDGr1YdrlfbU9wxTOdpf3zChmv9.jpg", backdrop: "/y3uOfZAYwLkbvhunswBCskNMrfI.jpg" },
}

const url = (size: string, path: string) => `https://image.tmdb.org/t/p/${size}${path}`
const key = (title: Title | string) => (typeof title === "string" ? title : title.key)
/** A poster (2:3). w342 is enough for a tile; w500 for a poster that fills the height of the TV. */
export const posterOf = (title: Title | string, size: "w342" | "w500" = "w342") => url(size, ART[key(title)].poster)
/** A backdrop (16:9). w780 for a card, w1280 for the whole picture. */
export const backdropOf = (title: Title | string, size: "w780" | "w1280" = "w780") => url(size, ART[key(title)].backdrop)
