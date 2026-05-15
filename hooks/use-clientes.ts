import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getClientesPaginated, 
  addCliente, 
  updateCliente, 
  deleteCliente 
} from "@/lib/firebase-service"
import { useAuth } from "@/hooks/use-auth"
import type { Cliente } from "@/lib/types"

export function useClientes() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ["clientes", user?.uid],
    queryFn: ({ pageParam }) => {
      if (!user?.uid) throw new Error("Usuário não autenticado")
      return getClientesPaginated(user.uid, 20, pageParam)
    },
    initialPageParam: null as any,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastVisible : undefined,
    enabled: !!user,
  })

  const addMutation = useMutation({
    mutationFn: (newCliente: Omit<Cliente, "id" | "numeroUnico" | "createdAt" | "updatedAt" | "userId">) => 
      addCliente(newCliente, user!.uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Cliente> }) => 
      updateCliente(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCliente(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
    },
  })

  return {
    clientes: data?.pages.flatMap(page => page.data) || [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    addCliente: addMutation.mutateAsync,
    updateCliente: updateMutation.mutateAsync,
    deleteCliente: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}