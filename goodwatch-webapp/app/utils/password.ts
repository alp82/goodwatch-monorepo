export const validatePassword = (
	password: string,
): {
	isValid: boolean;
	errors: string[];
} => {
	const errors: string[] = [];

	if (password.length < 10) {
		errors.push("Password must be at least 10 characters long");
	}

	if (!/[a-z]/.test(password)) {
		errors.push("Password must contain at least one lowercase letter");
	}

	if (!/[A-Z]/.test(password)) {
		errors.push("Password must contain at least one uppercase letter");
	}

	if (!/\d/.test(password)) {
		errors.push("Password must contain at least one number");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};
