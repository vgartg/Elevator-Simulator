package main

import (
	"fmt"
	"log"

	"github.com/vgartg/elevator-simulator/internal/elevator"
)

func main() {
	b, err := elevator.NewBuilding(10, 2)
	if err != nil {
		log.Fatal(err)
	}

	must(b.Call(7, elevator.DirectionDown))
	must(b.Call(3, elevator.DirectionUp))
	must(b.Select(2, 9))

	fmt.Println("tick  cabin#1            cabin#2            calls")
	fmt.Println("----  -----------------  -----------------  -----")
	for i := 1; i <= 14; i++ {
		b.Tick()
		s := b.GetSnapshot()
		fmt.Printf("%4d  %-17s  %-17s  %d\n",
			i, format(s.Elevators[0]), format(s.Elevators[1]), len(s.Calls))
	}

	stats := b.GetSnapshot().Stats
	fmt.Printf("\nstops served: %d  calls placed: %d\n", stats.StopsServed, stats.CallsPlaced)
}

func format(e elevator.Elevator) string {
	door := "."
	if e.DoorsOpen {
		door = "open"
	}
	return fmt.Sprintf("F%-2d %-4s %s", e.CurrentFloor, e.Direction, door)
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
