package dtos

import "testing"

func TestCreateContractDtoVariable(t *testing.T) {
	yes, no := true, false
	tests := []struct {
		name       string
		isContract bool
		isVariable *bool
		want       bool
	}{
		{"contract is always fixed", true, &yes, false},
		{"explicit variable", false, &yes, true},
		{"explicit fixed", false, &no, false},
		{"missing value (older export) means variable", false, nil, true},
		{"missing value on a contract means fixed", true, nil, false},
	}
	for _, tt := range tests {
		d := CreateContractDto{IsContract: tt.isContract, IsVariable: tt.isVariable}
		if got := d.Variable(); got != tt.want {
			t.Errorf("%s: Variable() = %v, want %v", tt.name, got, tt.want)
		}
	}
}
