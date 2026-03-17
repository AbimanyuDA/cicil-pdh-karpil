import Foundation
import Vision
import CoreImage

let imageURL = URL(fileURLWithPath: "/Users/abimanyudans/Project/GKJW KArangpilang/cicil-pdh-karpil/public/qris.jpg")
let request = VNDetectBarcodesRequest()
let handler = VNImageRequestHandler(url: imageURL)

try handler.perform([request])

if let results = request.results as? [VNBarcodeObservation],
   let first = results.first,
   let payload = first.payloadStringValue {
    print(payload)
} else {
    fputs("NO_QR_FOUND\n", stderr)
    exit(1)
}
