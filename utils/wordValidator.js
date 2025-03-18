/**
 * Utility to validate words for the game
 */

// English dictionary - in a real app, you would use a proper dictionary API or database
// This is a simplified version with a small set of common words
const englishWords = [
  'apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew',
  'kiwi', 'lemon', 'mango', 'nectarine', 'orange', 'papaya', 'quince', 'raspberry',
  'strawberry', 'tangerine', 'watermelon', 'zucchini', 'avocado', 'blackberry', 'coconut',
  'dragon', 'eggplant', 'fennel', 'garlic', 'hazelnut', 'iceberg', 'jackfruit',
  'kale', 'lime', 'mushroom', 'nutmeg', 'onion', 'peanut', 'quinoa', 'radish',
  'spinach', 'tomato', 'vanilla', 'walnut', 'yam', 'almond', 'broccoli', 'cabbage',
  'durian', 'endive', 'flour', 'ginger', 'honey', 'jalapeno', 'kohlrabi', 'lettuce',
  'melon', 'noodle', 'olive', 'pepper', 'raisin', 'saffron', 'thyme', 'vinegar',
  'wasabi', 'yogurt', 'bread', 'cheese', 'donut', 'egg', 'fish', 'grain', 'ham',
  'ice', 'jam', 'ketchup', 'lentil', 'milk', 'nut', 'oat', 'pasta', 'rice',
  'sugar', 'tea', 'water', 'bean', 'corn', 'dill', 'flour', 'gum', 'herb',
  'juice', 'kiwi', 'leek', 'mint', 'oil', 'pea', 'rye', 'salt', 'tofu'
];

// In a production app, you would use a more comprehensive dictionary
// or connect to a dictionary API

/**
 * Check if a word contains the required letters
 * @param {string} word - The word to check
 * @param {string[]} requiredLetters - Array of letters that must be in the word
 * @returns {boolean} True if the word contains all required letters
 */
const containsRequiredLetters = (word, requiredLetters) => {
  const wordUpperCase = word.toUpperCase();
  return requiredLetters.every(letter => wordUpperCase.includes(letter));
};

/**
 * Check if a word is valid (exists in dictionary and contains required letters)
 * @param {string} word - The word to validate
 * @param {string[]} requiredLetters - Array of letters that must be in the word
 * @returns {boolean} True if the word is valid
 */
const isValidWord = (word, requiredLetters) => {
  // Check if word is at least 3 characters long
  if (!word || word.length < 3) {
    return false;
  }
  
  // Check if word is in the dictionary
  // In a real app, you would use a more comprehensive dictionary check
  if (!englishWords.includes(word.toLowerCase())) {
    return false;
  }
  
  // Check if word contains all required letters
  if (!containsRequiredLetters(word, requiredLetters)) {
    return false;
  }
  
  return true;
};

/**
 * Get a list of valid words that contain the required letters
 * @param {string[]} requiredLetters - Array of letters that must be in the word
 * @returns {string[]} Array of valid words
 */
const getValidWords = (requiredLetters) => {
  return englishWords.filter(word => containsRequiredLetters(word, requiredLetters));
};

module.exports = {
  isValidWord,
  getValidWords,
  containsRequiredLetters
}; 