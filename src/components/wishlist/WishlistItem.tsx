
import { useState } from "react";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageLoader } from "@/components/ImageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Share2, ShoppingCart, Trash2, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WishlistItemProps {
  item: {
    id: string;
    product_id: string;
  };
  product: Product;
  onItemRemoved?: () => void;
}

export const WishlistItem = ({ item, product, onItemRemoved }: WishlistItemProps) => {
  const [isSharing, setIsSharing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const removeFromWishlist = useMutation({
    mutationFn: async () => {
      console.log("Removing wishlist item:", item.id);
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", item.id);

      if (error) {
        console.error("Error removing wishlist item:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["wishlist-items"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist", product.id] });
      toast.success("Item removed from wishlist");
      if (onItemRemoved) {
        onItemRemoved();
      }
    },
    onError: (error) => {
      console.error("Error removing from wishlist:", error);
      toast.error("Failed to remove item from wishlist");
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to add items to cart");

      const { error } = await supabase
        .from("cart_items")
        .insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartItems"] });
      toast.success("Added to cart successfully");
    },
    onError: (error) => {
      console.error("Error adding to cart:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to add to cart");
      }
    },
  });

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await navigator.share({
        title: product.title || "Check out this product",
        text: product.description || "I found this interesting product",
        url: window.location.origin + "/products/" + product.id,
      });
      toast.success("Product shared successfully");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Failed to share product");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const getImageUrl = () => {
    const mainImage = product.product_images?.find(img => img.is_main === true);
    if (mainImage?.storage_path) {
      const { data } = supabase.storage
        .from("images")
        .getPublicUrl(mainImage.storage_path);
      return data.publicUrl;
    }
    return "/placeholder.svg";
  };

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow m-1">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-48 h-48 relative">
            <ImageLoader
              src={getImageUrl()}
              alt={product.title || ""}
              className="w-full h-full object-cover"
              width={192}
              height={192}
            />
            <Heart className="absolute top-1 left-1 w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <div className="flex-1 p-1 flex flex-col justify-between space-y-1">
            <div>
              <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">{product.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-1">
                {product.description}
              </p>
              <p className="text-lg font-medium text-orange-500">
                {product.currency} {Math.round(product.price || 0).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 mt-1 space-x-1">
              <Button
                variant="default"
                size="sm"
                onClick={() => addToCart.mutate()}
                disabled={!product.in_stock || addToCart.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white m-1 p-1"
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={isSharing}
                className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 m-1 p-1"
              >
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeFromWishlist.mutate()}
                disabled={removeFromWishlist.isPending}
                className="bg-red-600 hover:bg-red-700 m-1 p-1"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
