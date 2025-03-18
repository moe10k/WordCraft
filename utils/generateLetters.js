/**
 * Utility to generate random letters for the game
 */

// Letter frequency in English language (approximate)
const letterFrequency = {
  'A': 8.2, 'B': 1.5, 'C': 2.8, 'D': 4.3, 'E': 12.7, 'F': 2.2, 'G': 2.0,
  'H': 6.1, 'I': 7.0, 'J': 0.2, 'K': 0.8, 'L': 4.0, 'M': 2.4, 'N': 6.7,
  'O': 7.5, 'P': 1.9, 'Q': 0.1, 'R': 6.0, 'S': 6.3, 'T': 9.1, 'U': 2.8,
  'V': 1.0, 'W': 2.4, 'X': 0.2, 'Y': 2.0, 'Z': 0.1
};

// Convert frequency to a weighted array for random selection
const weightedLetters = [];
for (const [letter, frequency] of Object.entries(letterFrequency)) {
  // Multiply by 10 and round to get integer weights
  const weight = Math.round(frequency * 10);
  for (let i = 0; i < weight; i++) {
    weightedLetters.push(letter);
  }
}

/**
 * Generate a random letter based on English language frequency
 * @returns {string} A random uppercase letter
 */
const generateRandomLetter = () => {
  const randomIndex = Math.floor(Math.random() * weightedLetters.length);
  return weightedLetters[randomIndex];
};

/**
 * Generate a pair of random letters
 * @param {number} count - Number of letters to generate (default: 2)
 * @returns {string[]} Array of random letters
 */
const generateLetters = (count = 2) => {
  const letters = [];
  for (let i = 0; i < count; i++) {
    letters.push(generateRandomLetter());
  }
  return letters;
};

module.exports = {
  generateLetters,
  generateRandomLetter
}; 