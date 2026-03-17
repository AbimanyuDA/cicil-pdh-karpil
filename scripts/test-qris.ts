import { generateDynamicQRIS } from '../lib/qris'

const staticQr = '00020101021126570011ID.DANA.WWW011893600915363797436702096379743670303UMI51440014ID.CO.QRIS.WWW0215ID10243210741390303UMI5204581353033605802ID5912WaroengDans6013KotaSurabaya6105602226304AD4D'

try {
  const result = generateDynamicQRIS(staticQr, 50000)
  console.log(result)
  console.log('length=', result.length)
} catch (error) {
  console.error(error)
  process.exit(1)
}
