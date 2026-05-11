/**
 * Calculates candidate age from available data
 * @param {Object} candidate - Candidate object
 * @returns {Object} - { age: number, source: string, isEmpty: boolean }
 */
export function calculateCandidateAge(candidate) {
  const currentYear = new Date().getFullYear();
  
  // Method 1: Use date_of_birth
  if (candidate.date_of_birth) {
    try {
      const birthDate = new Date(candidate.date_of_birth);
      const age = currentYear - birthDate.getFullYear();
      // Adjust for whether birthday has passed this year
      const currentDate = new Date();
      const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      const adjustedAge = currentDate < birthdayThisYear ? age - 1 : age;
      return { age: Math.max(0, adjustedAge), source: 'תאריך לידה', isEmpty: false };
    } catch (e) {
      console.log('Invalid date_of_birth:', candidate.date_of_birth);
    }
  }

  // Method 2: Use military_discharge_year
  // Army is typically 18-21, we estimate starting at 18
  if (candidate.military_discharge_year) {
    try {
      const dischargeYear = parseInt(candidate.military_discharge_year, 10);
      if (!isNaN(dischargeYear)) {
        // Assume soldier was discharged at 21 (standard service length)
        const ageAtDischarge = 21;
        const yearsAgo = currentYear - dischargeYear;
        const age = ageAtDischarge + yearsAgo;
        return { age: Math.max(0, age), source: 'מועד סיום צבא', isEmpty: false };
      }
    } catch (e) {
      console.log('Invalid military_discharge_year:', candidate.military_discharge_year);
    }
  }

  return { age: null, source: null, isEmpty: true };
}

/**
 * Checks if candidate age is over 60
 * @param {Object} candidate - Candidate object
 * @returns {boolean} - true if age > 60, false otherwise
 */
export function isOlderThan60(candidate) {
  const { age, isEmpty } = calculateCandidateAge(candidate);
  if (isEmpty) return false;
  return age > 60;
}