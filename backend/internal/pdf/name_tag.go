package pdf

import (
	"bytes"

	"github.com/jung-kurt/gofpdf"
)

type Input struct {
	FullName      string
	Organization  string
	ReferenceCode string
}

func GenerateNameTag(input Input) ([]byte, error) {
	doc := gofpdf.New("P", "mm", "A6", "")
	doc.AddPage()
	doc.SetMargins(10, 10, 10)
	doc.SetFont("Arial", "B", 22)
	doc.MultiCell(0, 10, input.FullName, "", "C", false)
	doc.Ln(4)
	doc.SetFont("Arial", "", 14)
	doc.MultiCell(0, 8, input.Organization, "", "C", false)
	doc.Ln(4)
	doc.SetFont("Arial", "", 12)
	doc.MultiCell(0, 8, input.ReferenceCode, "", "C", false)
	var buf bytes.Buffer
	if err := doc.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
