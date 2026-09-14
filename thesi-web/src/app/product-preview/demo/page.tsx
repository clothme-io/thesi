import { ProductPreviewView } from "../ProductPreviewView";
export const metadata = { title: "Product preview demo | Thesi" };
export default function DemoPage() {
  return <ProductPreviewView sample product={{ brandName: "Studio Form · Sample brand", title: "The everyday linen shirt", imageUrl: null, description: "An easy layer for slower mornings and days on the move. This sample product introduces the details creators will see before choosing to promote a campaign.\n\nRelaxed silhouette. Soft neutral colour. Made for an effortless everyday look." }} />;
}
