export interface BinaryOperationInput {
  left: number;
  right: number;
}

export const add = ({ left, right }: BinaryOperationInput): number => left + right;

export const subtract = ({ left, right }: BinaryOperationInput): number => left - right;

export const multiply = ({ left, right }: BinaryOperationInput): number => left * right;

export const divide = ({ left, right }: BinaryOperationInput): number => {
  if (right === 0) {
    throw new Error("Cannot divide by zero.");
  }

  return left / right;
};

export const percentage = ({ left, right }: BinaryOperationInput): number => {
  if (right === 0) {
    throw new Error("Cannot calculate percentage with zero base.");
  }

  return (left / right) * 100;
};
