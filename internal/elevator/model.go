package elevator

type Elevator struct {
	ID           int    `json:"id"`
	CurrentFloor int    `json:"currentFloor"`
	Direction    string `json:"direction"`
	IsMoving     bool   `json:"isMoving"`
	DoorsOpen    bool   `json:"doorsOpen"`
}

type State struct {
	Elevators []Elevator `json:"elevators"`
	Floors    int        `json:"floors"`
}
