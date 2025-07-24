/**
 * Common country/region mappings used across different data processing scripts
 */

const regionToCountryCode = {
  // Rest of World variations
  'RoW': 'RoW',
  'ROW': 'RoW',
  'Row': 'RoW',
  'Rest-of-World': 'RoW',
  'Rest of World': 'RoW',
  'Rest-of-World (RoW)': 'RoW',
  
  // Global variations
  'Global (GLO)': 'GLO',
  'Global Average': 'GLO',
  'Global': 'GLO',
  'GLO': 'GLO',
  
  // European regions
  'Europe': 'EU',
  'Europe (RER)': 'EU',
  'Europe without Switzerland': 'EU-CH',
  
  // Individual countries
  'Germany': 'DE',
  'Sweden': 'SE',
  'China': 'CN',
  'Belgium': 'BE',
  'Brazil': 'BR',
  'Canada': 'CA',
  'Egypt': 'EG',
  'Thailand': 'TH',
  'Italy': 'IT',
  'Turkey': 'TR',
  'France': 'FR',
  'Netherlands': 'NL',
  'Poland': 'PL',
  'Spain': 'ES',
  'Switzerland (CH)': 'CH',
  'United Kingdom': 'GB',
  'United States': 'US',
  'United States.': 'US',
  'India': 'IN',
  'Vietnam': 'VN',
  'Taiwan': 'TW',
  'Philippines': 'PH',
  'Czech Republic': 'CZ',
  'Colombia': 'CO',
  'Ecuador': 'EC',
  
  // Special regions
  'Italy-Europe-Central': 'IT-EC',
  'IAI Area, EU27 & EFTA': 'IAI-EU',
  'IAI Area, North America': 'IAI-NA',
};

/**
 * Normalize and map country/region name to standard code
 * @param {string} regionName - The region/country name to normalize
 * @returns {string} - The normalized country code
 */
function normalizeCountryCode(regionName) {
  if (!regionName || typeof regionName !== 'string' || regionName.trim() === '') {
    return 'Unknown';
  }
  
  // Clean up the region name
  let cleanName = regionName.trim();
  
  // Direct mapping
  if (regionToCountryCode[cleanName]) {
    return regionToCountryCode[cleanName];
  }
  
  // Try to extract from patterns like "Global (GLO)" or "China (CN)"
  const matches = cleanName.match(/\(([^)]+)\)/);
  if (matches && matches[1]) {
    const extracted = matches[1];
    if (regionToCountryCode[extracted]) {
      return regionToCountryCode[extracted];
    }
    return extracted;
  }
  
  // Case-insensitive lookup
  const lowerName = cleanName.toLowerCase();
  for (const [key, value] of Object.entries(regionToCountryCode)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  // If no mapping found, try to clean and return the original
  // Remove parentheses and extra spaces
  cleanName = cleanName.replace(/[()]/g, '').trim();
  
  // Handle some common patterns
  if (cleanName.toLowerCase().includes('global')) return 'GLO';
  if (cleanName.toLowerCase().includes('rest') || cleanName.toLowerCase().includes('row')) return 'RoW';
  
  // Return the first word if it looks like a country code (2-3 letters)
  const firstWord = cleanName.split(' ')[0];
  if (firstWord.length <= 3 && firstWord.match(/^[A-Z]+$/i)) {
    return firstWord.toUpperCase();
  }
  
  // Default to original cleaned name
  return cleanName;
}

module.exports = {
  regionToCountryCode,
  normalizeCountryCode
};