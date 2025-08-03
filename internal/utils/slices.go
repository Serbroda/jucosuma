package utils

func MapSlice[T any, U any](input []T, mapper func(T) U) []U {
	output := make([]U, len(input))
	for i, item := range input {
		output[i] = mapper(item)
	}
	return output
}
