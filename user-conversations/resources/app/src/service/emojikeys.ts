/*
 * EmojiKeys are the human-friendly fingerprints that let users verify encryption
 * keys by eye: SHA-256 the input, then map the digest's first ten bytes into five
 * emojis (two bytes each, big-endian, modulo the table size).
 *
 * INTEROP: the algorithm and the 350-entry table below are a wire-level contract
 * shared verbatim with Bonfire (tauri-plugin-openmls, `signature_key_to_emoji_fingerprint`)
 * and mirrored by Emissary's display-only `tools/emojikey` package. Never change
 * one copy alone.
 */
import { type KeyPackage } from "ts-mls";

import { uint8ArrayToBase64 } from "./utils";
import { type EmojiKey } from "../model/emoji";

/** emojiKey hashes the input bytes and returns the digest (base64) with its five-emoji fingerprint */
export async function emojiKey(input: Uint8Array): Promise<[string, EmojiKey[]]> {

	// Hash the input; the emojis always render the SHA-256 digest, never the raw input
	const checksum = await crypto.subtle.digest('SHA-256', input.slice(0))
	const checksumHash = new Uint8Array(checksum);

	if (checksumHash.length != 32) {
		throw new Error("Checksum must be 32 characters long")
	}

	const base64 = uint8ArrayToBase64(checksumHash)

	// Map the first ten digest bytes into five emojis
	const result: EmojiKey[] = new Array<EmojiKey>(5)

	for (let i = 0; i < 5; i++) {
		const first = checksumHash[i * 2] // First byte
		const second = checksumHash[i * 2 + 1] // Second byte
		const combined = (first! << 8 | second!) // Shift and combine (bitwise-OR)
		const index = combined % emojiSet.length  // Modulo 350 to get a valid index
		result[i] = emojiSet[index]!; // Add to result (non-null assertion since we know the index is valid)
	}

	return [base64, result];
}

/** keyPackageEmojiKey returns the emoji fingerprint that identifies a KeyPackage's owner */
export async function keyPackageEmojiKey(keyPackage: KeyPackage): Promise<[string, EmojiKey[]]> {

	// INTEROP: the fingerprint input is the leaf node's raw signature public key — NOT the
	// KeyPackage's `signature` field. The signature public key is the only value peers can
	// recover for an existing group member (the ratchet tree keeps the leaf's signature key,
	// not the original KeyPackage signature), and it is the value Bonfire fingerprints.
	return emojiKey(keyPackage.leafNode.signaturePublicKey)
}

/** emojiKeySummary flattens an EmojiKey into the plain emoji string published as the ActivityStreams `summary` */
export function emojiKeySummary(emojis: EmojiKey[]): string {
	return emojis.map(emoji => emoji[0]).join("")
}

const emojiSet: EmojiKey[] = [
	["🐶", "Dog"], ["🐱", "Cat"], ["🦁", "Lion"],
	["🐎", "Horse"], ["🦄", "Unicorn"], ["🐷", "Pig"],
	["🐘", "Elephant"], ["🐰", "Rabbit"], ["🐼", "Panda"],
	["🐓", "Rooster"], ["🐧", "Penguin"], ["🐢", "Turtle"],
	["🐟", "Fish"], ["🐙", "Octopus"], ["🦋", "Butterfly"],
	["🌷", "Flower"], ["🌳", "Tree"], ["🌵", "Cactus"],
	["🍄", "Mushroom"], ["🌏", "Globe"], ["🌙", "Moon"],
	["☁️", "Cloud"], ["🔥", "Fire"], ["🍌", "Banana"],
	["🍎", "Apple"], ["🍓", "Strawberry"], ["🌽", "Corn"],
	["🍕", "Pizza"], ["🎂", "Cake"], ["❤️", "Heart"],
	["😀", "Smiley"], ["🤖", "Robot"], ["🎩", "Hat"],
	["👓", "Glasses"], ["🔧", "Spanner"], ["🎅", "Santa"],
	["👍", "Thumbs Up"], ["☂️", "Umbrella"], ["⌛", "Hourglass"],
	["⏰", "Clock"], ["🎁", "Gift"], ["💡", "Light Bulb"],
	["📕", "Book"], ["✏️", "Pencil"], ["📎", "Paperclip"],
	["✂️", "Scissors"], ["🔒", "Lock"], ["🔑", "Key"],
	["🔨", "Hammer"], ["☎️", "Telephone"], ["🏁", "Flag"],
	["🚂", "Train"], ["🚲", "Bicycle"], ["✈️", "Aeroplane"],
	["🚀", "Rocket"], ["🏆", "Trophy"], ["⚽", "Ball"],
	["🎸", "Guitar"], ["🎺", "Trumpet"], ["🔔", "Bell"],
	["⚓", "Anchor"], ["🎧", "Headphones"], ["📁", "Folder"],
	["📌", "Pin"], ["0️⃣", "Zero"], ["1️⃣", "One"],
	["2️⃣", "Two"], ["3️⃣", "Three"], ["4️⃣", "Four"],
	["5️⃣", "Five"], ["6️⃣", "Six"], ["7️⃣", "Seven"],
	["8️⃣", "Eight"], ["9️⃣", "Nine"], ["♻️", "Recycle"],
	["⚡", "Lightning"], ["💎", "Diamond"], ["🌈", "Rainbow"],
	["❄️", "Snowflake"], ["🌊", "Wave"], ["🎲", "Dice"],
	["🧲", "Magnet"], ["🪐", "Saturn"], ["🌋", "Volcano"],
	["⭐", "Star"], ["🐬", "Dolphin"], ["🦊", "Fox"],
	["🦉", "Owl"], ["🏔️", "Mountain"], ["🧊", "Ice"],
	["🎯", "Target"], ["🛡️", "Shield"], ["⚙️", "Gear"],
	["🔱", "Trident"], ["🦀", "Crab"], ["🦈", "Shark"],
	["🐸", "Frog"], ["🦩", "Flamingo"], ["🦜", "Parrot"],
	["🐍", "Snake"], ["🦞", "Lobster"], ["🐪", "Camel"],
	["🦒", "Giraffe"], ["🐊", "Crocodile"], ["🍉", "Watermelon"],
	["🍇", "Grapes"], ["🍒", "Cherry"], ["🥥", "Coconut"],
	["🌶️", "Chilli"], ["🧀", "Cheese"], ["🍩", "Donut"],
	["🧁", "Cupcake"], ["🍿", "Popcorn"], ["🏠", "House"],
	["🏰", "Castle"], ["⛵", "Sailboat"], ["🚁", "Helicopter"],
	["🛸", "UFO"], ["🎭", "Theatre"], ["🎪", "Circus"],
	["🎈", "Balloon"], ["🧩", "Puzzle"], ["🪁", "Kite"],
	["🏹", "Bow"], ["🪴", "Plant"], ["🌻", "Sunflower"],
	["🌴", "Palm"], ["🍂", "Leaf"], ["🐚", "Shell"],
	["🦎", "Lizard"], ["🦭", "Seal"], ["🦔", "Hedgehog"],
	["🦚", "Peacock"], ["🐞", "Ladybug"], ["🕷️", "Spider"],
	["🎱", "Billiards"], ["🛶", "Canoe"], ["🎻", "Violin"],
	["🥁", "Drum"], ["🎤", "Microphone"], ["🔭", "Telescope"],
	["🔬", "Microscope"], ["💊", "Pill"], ["🧬", "DNA"],
	["🧪", "Test Tube"], ["🕯️", "Candle"], ["💰", "Money Bag"],
	["👑", "Crown"], ["🪶", "Feather"], ["⛏️", "Pickaxe"],
	["🪨", "Rock"], ["🏮", "Lantern"], ["🎀", "Ribbon"],
	["🪵", "Log"], ["🛞", "Wheel"], ["🪜", "Ladder"],
	["🧯", "Extinguisher"], ["🎓", "Graduation"], ["💍", "Ring"],
	["🩺", "Stethoscope"], ["🪃", "Boomerang"], ["🏺", "Amphora"],
	["🗿", "Moai"], ["🗽", "Liberty"], ["⛩️", "Shrine"],
	["🕌", "Mosque"], ["🎡", "Ferris Wheel"], ["🎢", "Roller Coaster"],
	["🚢", "Ship"], ["🛰️", "Satellite"], ["🌠", "Shooting Star"],
	["🌀", "Cyclone"], ["🔮", "Crystal Ball"], ["🪩", "Mirror Ball"],
	["🎵", "Music"], ["🕹️", "Joystick"], ["🖨️", "Printer"],
	["💾", "Floppy"], ["🔋", "Battery"], ["📡", "Dish"],
	["🏋️", "Weightlifter"], ["🤿", "Diving"], ["🛹", "Skateboard"],
	["🧳", "Suitcase"], ["🪝", "Hook"], ["🧸", "Teddy Bear"],
	["🎏", "Carp Streamer"], ["🏕️", "Camping"], ["🗺️", "World Map"],
	["🧶", "Yarn"], ["🎐", "Wind Chime"], ["🦇", "Bat"],
	["🛒", "Cart"], ["🦷", "Tooth"], ["🫀", "Heart Organ"],
	["🧠", "Brain"], ["👁️", "Eye"], ["🦴", "Bone"],
	["🪸", "Coral"], ["🐌", "Snail"], ["🦂", "Scorpion"],
	["🕊️", "Dove"], ["🦙", "Llama"], ["🦘", "Kangaroo"],
	["🦫", "Beaver"], ["🦦", "Otter"], ["🦥", "Sloth"],
	["🍑", "Peach"], ["🥝", "Kiwi"], ["🥑", "Avocado"],
	["🥕", "Carrot"], ["🥨", "Pretzel"], ["🥐", "Croissant"],
	["🍭", "Lollipop"], ["🫐", "Blueberry"], ["🥦", "Broccoli"],
	["🌰", "Chestnut"], ["🥜", "Peanut"], ["🍯", "Honey"],
	["🧂", "Salt"], ["🫖", "Teapot"], ["🍵", "Tea"],
	["🧃", "Juice Box"], ["🪘", "Long Drum"], ["🎷", "Saxophone"],
	["🎹", "Piano"], ["🪗", "Accordion"], ["🏗️", "Crane"],
	["🗼", "Tower"], ["⛲", "Fountain"], ["🎠", "Carousel"],
	["🛥️", "Speedboat"], ["🚜", "Tractor"], ["🚒", "Fire Engine"],
	["🚑", "Ambulance"], ["🛴", "Scooter"], ["🪂", "Parachute"],
	["🏄", "Surfer"], ["⛷️", "Skier"], ["🏊", "Swimmer"],
	["🛷", "Sled"], ["🧨", "Firecracker"], ["🎃", "Pumpkin"],
	["🎳", "Bowling"], ["🏓", "Ping Pong"], ["🥊", "Boxing"],
	["🏒", "Hockey"], ["🎿", "Ski"], ["🪀", "Yo-Yo"],
	["🛼", "Roller Skate"], ["🧗", "Climber"], ["🏇", "Jockey"],
	["🪈", "Flute"], ["📯", "Horn"], ["🎙️", "Studio Mic"],
	["📻", "Radio"], ["📺", "Television"], ["🖥️", "Desktop"],
	["💿", "CD"], ["🔦", "Flashlight"], ["🪫", "Low Battery"],
	["🧰", "Toolbox"], ["🪚", "Saw"], ["🔩", "Nut & Bolt"],
	["🧱", "Brick"], ["⛓️", "Chain"], ["🪣", "Bucket"],
	["🪦", "Headstone"], ["🔗", "Link"], ["🪟", "Window"],
	["🚪", "Door"], ["🛏️", "Bed"], ["🪑", "Chair"],
	["🚿", "Shower"], ["🧴", "Lotion"], ["🧽", "Sponge"],
	["🕶️", "Sunglasses"], ["🥾", "Boot"], ["👒", "Sun Hat"],
	["🧤", "Gloves"], ["🧣", "Scarf"], ["👔", "Necktie"],
	["👗", "Dress"], ["🩰", "Ballet"], ["🪭", "Fan"],
	["💄", "Lipstick"], ["💈", "Barber Pole"], ["🔍", "Magnifier"],
	["📿", "Prayer Beads"], ["🪬", "Hamsa"], ["♟️", "Chess Pawn"],
	["🀄", "Mahjong"], ["🃏", "Joker"], ["🖼️", "Frame"],
	["🪆", "Nesting Doll"], ["🏷️", "Label"], ["📮", "Postbox"],
	["🗑️", "Wastebasket"], ["🚩", "Red Flag"], ["🏴‍☠️", "Pirate Flag"],
	["🪧", "Placard"], ["📬", "Mailbox"], ["🪙", "Coin"],
	["💳", "Credit Card"], ["📐", "Triangle Ruler"], ["🗓️", "Calendar"],
	["📊", "Bar Chart"], ["🔖", "Bookmark"], ["🏵️", "Rosette"],
	["🎗️", "Reminder Ribbon"], ["🪢", "Knot"], ["🩻", "X-Ray"],
	["🪪", "ID Card"], ["🛗", "Elevator"], ["🚦", "Traffic Light"],
	["⛽", "Fuel Pump"], ["🚧", "Construction"], ["🛟", "Ring Buoy"],
	["🪔", "Diya Lamp"], ["🎑", "Moon Viewing"], ["🧧", "Red Envelope"],
	["🎍", "Bamboo"], ["🪷", "Lotus"], ["🍁", "Maple Leaf"],
	["☘️", "Shamrock"], ["🦠", "Microbe"], ["🪺", "Nest"],
	["🧮", "Abacus"], ["📣", "Megaphone"], ["🏅", "Medal"],
	["⛺", "Tent"], ["🫧", "Soap Bubble"], ["🏳️‍🌈", "Pride Flag"],
	["🏳️‍⚧️", "Transgender Flag"], ["🏴", "Black Flag"], ["🇯🇵", "Japan"],
	["🇧🇷", "Brazil"], ["🇨🇦", "Canada"], ["☀️", "Sun"],
	["🌕", "Full Moon"], ["🔰", "Beginner"], ["♾️", "Infinity"],
	["🏝️", "Island"], ["🌾", "Rice"], ["🫶", "Heart Hands"],
	["🦤", "Dodo"], ["🫏", "Donkey"], ["🐉", "Dragon"],
	["🦬", "Bison"], ["🪻", "Hyacinth"]
]