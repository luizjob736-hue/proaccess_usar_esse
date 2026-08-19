export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      acessos: {
        Row: {
          atualizado_em: string;
          colaborador_id: string;
          concedido_em: string | null;
          concedido_por: string | null;
          criado_em: string;
          expira_em: string | null;
          id: string;
          login: string | null;
          observacoes: string | null;
          perfil_acesso_id: string | null;
          senha: string | null;
          sistema_id: string;
          status: Database["public"]["Enums"]["acesso_status"];
        };
        Insert: {
          atualizado_em?: string;
          colaborador_id: string;
          concedido_em?: string | null;
          concedido_por?: string | null;
          criado_em?: string;
          expira_em?: string | null;
          id?: string;
          login?: string | null;
          observacoes?: string | null;
          perfil_acesso_id?: string | null;
          senha?: string | null;
          sistema_id: string;
          status?: Database["public"]["Enums"]["acesso_status"];
        };
        Update: {
          atualizado_em?: string;
          colaborador_id?: string;
          concedido_em?: string | null;
          concedido_por?: string | null;
          criado_em?: string;
          expira_em?: string | null;
          id?: string;
          login?: string | null;
          observacoes?: string | null;
          perfil_acesso_id?: string | null;
          senha?: string | null;
          sistema_id?: string;
          status?: Database["public"]["Enums"]["acesso_status"];
        };
        Relationships: [
          {
            foreignKeyName: "acessos_colaborador_id_fkey";
            columns: ["colaborador_id"];
            isOneToOne: false;
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acessos_perfil_acesso_id_fkey";
            columns: ["perfil_acesso_id"];
            isOneToOne: false;
            referencedRelation: "perfis_acesso";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acessos_sistema_id_fkey";
            columns: ["sistema_id"];
            isOneToOne: false;
            referencedRelation: "sistemas";
            referencedColumns: ["id"];
          },
        ];
      };
      chamado_comentarios: {
        Row: {
          autor_id: string;
          chamado_id: string;
          criado_em: string;
          id: string;
          mensagem: string;
        };
        Insert: {
          autor_id: string;
          chamado_id: string;
          criado_em?: string;
          id?: string;
          mensagem: string;
        };
        Update: {
          autor_id?: string;
          chamado_id?: string;
          criado_em?: string;
          id?: string;
          mensagem?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chamado_comentarios_chamado_id_fkey";
            columns: ["chamado_id"];
            isOneToOne: false;
            referencedRelation: "chamados";
            referencedColumns: ["id"];
          },
        ];
      };
      chamados: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          descricao: string | null;
          id: string;
          operador_id: string;
          print_url: string | null;
          resolvido_em: string | null;
          resposta: string | null;
          sistema_id: string | null;
          status: string;
          tipo: string;
          titulo: string;
          tratador_id: string | null;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          operador_id: string;
          print_url?: string | null;
          resolvido_em?: string | null;
          resposta?: string | null;
          sistema_id?: string | null;
          status?: string;
          tipo: string;
          titulo: string;
          tratador_id?: string | null;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          operador_id?: string;
          print_url?: string | null;
          resolvido_em?: string | null;
          resposta?: string | null;
          sistema_id?: string | null;
          status?: string;
          tipo?: string;
          titulo?: string;
          tratador_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chamados_sistema_id_fkey";
            columns: ["sistema_id"];
            isOneToOne: false;
            referencedRelation: "sistemas";
            referencedColumns: ["id"];
          },
        ];
      };
      colaborador_favoritos: {
        Row: {
          colaborador_id: string;
          criado_em: string;
          user_id: string;
        };
        Insert: {
          colaborador_id: string;
          criado_em?: string;
          user_id: string;
        };
        Update: {
          colaborador_id?: string;
          criado_em?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "colaborador_favoritos_colaborador_id_fkey";
            columns: ["colaborador_id"];
            isOneToOne: false;
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
        ];
      };
      colaboradores: {
        Row: {
          admissao_em: string | null;
          atualizado_em: string;
          cargo: string | null;
          cpf: string | null;
          criado_em: string;
          criado_por: string | null;
          desligamento_em: string | null;
          email: string | null;
          email_senha: string | null;
          em_pre_atendimento: boolean | null;
          foto_url: string | null;
          gestor_id: string | null;
          horario_entrada: string | null;
          horario_saida: string | null;
          id: string;
          inativado_em: string | null;
          matricula: string | null;
          nome: string;
          observacoes: string | null;
          operacao_id: string | null;
          produto: string | null;
          status: Database["public"]["Enums"]["colab_status"];
          telefone: string | null;
        };
        Insert: {
          admissao_em?: string | null;
          atualizado_em?: string;
          cargo?: string | null;
          cpf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desligamento_em?: string | null;
          email?: string | null;
          email_senha?: string | null;
          em_pre_atendimento?: boolean | null;
          foto_url?: string | null;
          gestor_id?: string | null;
          horario_entrada?: string | null;
          horario_saida?: string | null;
          id?: string;
          inativado_em?: string | null;
          matricula?: string | null;
          nome: string;
          observacoes?: string | null;
          operacao_id?: string | null;
          produto?: string | null;
          status?: Database["public"]["Enums"]["colab_status"];
          telefone?: string | null;
        };
        Update: {
          admissao_em?: string | null;
          atualizado_em?: string;
          cargo?: string | null;
          cpf?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          desligamento_em?: string | null;
          email?: string | null;
          email_senha?: string | null;
          em_pre_atendimento?: boolean | null;
          foto_url?: string | null;
          gestor_id?: string | null;
          horario_entrada?: string | null;
          horario_saida?: string | null;
          id?: string;
          inativado_em?: string | null;
          matricula?: string | null;
          nome?: string;
          observacoes?: string | null;
          operacao_id?: string | null;
          produto?: string | null;
          status?: Database["public"]["Enums"]["colab_status"];
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "colaboradores_gestor_id_fkey";
            columns: ["gestor_id"];
            isOneToOne: false;
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "colaboradores_operacao_id_fkey";
            columns: ["operacao_id"];
            isOneToOne: false;
            referencedRelation: "operacoes";
            referencedColumns: ["id"];
          },
        ];
      };
      historico: {
        Row: {
          acao: string;
          ator_id: string | null;
          criado_em: string;
          dados_antes: Json | null;
          dados_depois: Json | null;
          descricao: string | null;
          entidade: string;
          entidade_id: string | null;
          id: string;
        };
        Insert: {
          acao: string;
          ator_id?: string | null;
          criado_em?: string;
          dados_antes?: Json | null;
          dados_depois?: Json | null;
          descricao?: string | null;
          entidade: string;
          entidade_id?: string | null;
          id?: string;
        };
        Update: {
          acao?: string;
          ator_id?: string | null;
          criado_em?: string;
          dados_antes?: Json | null;
          dados_depois?: Json | null;
          descricao?: string | null;
          entidade?: string;
          entidade_id?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      ia_conversas: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          titulo: string;
          user_id: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          titulo?: string;
          user_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ia_mensagens: {
        Row: {
          content: string;
          conversa_id: string;
          criado_em: string;
          id: string;
          role: string;
        };
        Insert: {
          content: string;
          conversa_id: string;
          criado_em?: string;
          id?: string;
          role: string;
        };
        Update: {
          content?: string;
          conversa_id?: string;
          criado_em?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ia_mensagens_conversa_id_fkey";
            columns: ["conversa_id"];
            isOneToOne: false;
            referencedRelation: "ia_conversas";
            referencedColumns: ["id"];
          },
        ];
      };
      lista_acessos: {
        Row: {
          atualizado_em: string;
          colunas: Json;
          criado_em: string;
          id: string;
          linhas: Json;
          posicao: number;
          titulo: string;
        };
        Insert: {
          atualizado_em?: string;
          colunas?: Json;
          criado_em?: string;
          id?: string;
          linhas?: Json;
          posicao?: number;
          titulo: string;
        };
        Update: {
          atualizado_em?: string;
          colunas?: Json;
          criado_em?: string;
          id?: string;
          linhas?: Json;
          posicao?: number;
          titulo?: string;
        };
        Relationships: [];
      };
      lixeira: {
        Row: {
          entidade: string;
          entidade_id: string;
          excluido_em: string;
          excluido_por: string | null;
          id: string;
          snapshot: Json;
        };
        Insert: {
          entidade: string;
          entidade_id: string;
          excluido_em?: string;
          excluido_por?: string | null;
          id?: string;
          snapshot: Json;
        };
        Update: {
          entidade?: string;
          entidade_id?: string;
          excluido_em?: string;
          excluido_por?: string | null;
          id?: string;
          snapshot?: Json;
        };
        Relationships: [];
      };
      logs_auditoria: {
        Row: {
          ator_id: string | null;
          criado_em: string;
          evento: string;
          id: string;
          ip: string | null;
          meta: Json | null;
          user_agent: string | null;
        };
        Insert: {
          ator_id?: string | null;
          criado_em?: string;
          evento: string;
          id?: string;
          ip?: string | null;
          meta?: Json | null;
          user_agent?: string | null;
        };
        Update: {
          ator_id?: string | null;
          criado_em?: string;
          evento?: string;
          id?: string;
          ip?: string | null;
          meta?: Json | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      notificacoes: {
        Row: {
          corpo: string | null;
          criado_em: string;
          destinatario_id: string;
          id: string;
          lida: boolean;
          link: string | null;
          tipo: string;
          titulo: string;
        };
        Insert: {
          corpo?: string | null;
          criado_em?: string;
          destinatario_id: string;
          id?: string;
          lida?: boolean;
          link?: string | null;
          tipo?: string;
          titulo: string;
        };
        Update: {
          corpo?: string | null;
          criado_em?: string;
          destinatario_id?: string;
          id?: string;
          lida?: boolean;
          link?: string | null;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [];
      };
      operacoes: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          criado_em: string;
          descricao: string | null;
          id: string;
          nome: string;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      pendencia_anexos: {
        Row: {
          criado_em: string;
          enviado_por: string | null;
          id: string;
          mime: string | null;
          nome: string;
          pendencia_id: string;
          tamanho: number | null;
          url: string;
        };
        Insert: {
          criado_em?: string;
          enviado_por?: string | null;
          id?: string;
          mime?: string | null;
          nome: string;
          pendencia_id: string;
          tamanho?: number | null;
          url: string;
        };
        Update: {
          criado_em?: string;
          enviado_por?: string | null;
          id?: string;
          mime?: string | null;
          nome?: string;
          pendencia_id?: string;
          tamanho?: number | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pendencia_anexos_pendencia_id_fkey";
            columns: ["pendencia_id"];
            isOneToOne: false;
            referencedRelation: "pendencias";
            referencedColumns: ["id"];
          },
        ];
      };
      pendencia_comentarios: {
        Row: {
          autor_id: string;
          conteudo: string;
          criado_em: string;
          id: string;
          pendencia_id: string;
        };
        Insert: {
          autor_id: string;
          conteudo: string;
          criado_em?: string;
          id?: string;
          pendencia_id: string;
        };
        Update: {
          autor_id?: string;
          conteudo?: string;
          criado_em?: string;
          id?: string;
          pendencia_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pendencia_comentarios_pendencia_id_fkey";
            columns: ["pendencia_id"];
            isOneToOne: false;
            referencedRelation: "pendencias";
            referencedColumns: ["id"];
          },
        ];
      };
      pendencias: {
        Row: {
          acesso_id: string | null;
          atualizado_em: string;
          checklist: Json;
          colaborador_id: string | null;
          concluido_em: string | null;
          criado_em: string;
          criado_por: string | null;
          data_inicio: string;
          data_resolucao: string | null;
          descricao: string | null;
          etiquetas: string[];
          id: string;
          posicao: number;
          prioridade: Database["public"]["Enums"]["pendencia_prioridade"];
          responsavel_id: string | null;
          sistema_id: string | null;
          sla_em: string | null;
          status: Database["public"]["Enums"]["pendencia_status"];
          tipo: Database["public"]["Enums"]["pendencia_tipo"];
          titulo: string;
          solicitado: boolean;
        };
        Insert: {
          acesso_id?: string | null;
          atualizado_em?: string;
          checklist?: Json;
          colaborador_id?: string | null;
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_inicio?: string;
          data_resolucao?: string | null;
          descricao?: string | null;
          etiquetas?: string[];
          id?: string;
          posicao?: number;
          prioridade?: Database["public"]["Enums"]["pendencia_prioridade"];
          responsavel_id?: string | null;
          sistema_id?: string | null;
          sla_em?: string | null;
          status?: Database["public"]["Enums"]["pendencia_status"];
          tipo?: Database["public"]["Enums"]["pendencia_tipo"];
          titulo: string;
          solicitado?: boolean;
        };
        Update: {
          acesso_id?: string | null;
          atualizado_em?: string;
          checklist?: Json;
          colaborador_id?: string | null;
          concluido_em?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          data_inicio?: string;
          data_resolucao?: string | null;
          descricao?: string | null;
          etiquetas?: string[];
          id?: string;
          posicao?: number;
          prioridade?: Database["public"]["Enums"]["pendencia_prioridade"];
          responsavel_id?: string | null;
          sistema_id?: string | null;
          sla_em?: string | null;
          status?: Database["public"]["Enums"]["pendencia_status"];
          tipo?: Database["public"]["Enums"]["pendencia_tipo"];
          titulo?: string;
          solicitado?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pendencias_acesso_id_fkey";
            columns: ["acesso_id"];
            isOneToOne: false;
            referencedRelation: "acessos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pendencias_colaborador_id_fkey";
            columns: ["colaborador_id"];
            isOneToOne: false;
            referencedRelation: "colaboradores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pendencias_sistema_id_fkey";
            columns: ["sistema_id"];
            isOneToOne: false;
            referencedRelation: "sistemas";
            referencedColumns: ["id"];
          },
        ];
      };
      perfis_acesso: {
        Row: {
          criado_em: string;
          descricao: string | null;
          id: string;
          nome: string;
          sistema_id: string;
        };
        Insert: {
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          sistema_id: string;
        };
        Update: {
          criado_em?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          sistema_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_sistema_id_fkey";
            columns: ["sistema_id"];
            isOneToOne: false;
            referencedRelation: "sistemas";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          avatar_url: string | null;
          criado_em: string;
          email: string;
          id: string;
          nome: string;
          senha_alterada: boolean;
          ultima_senha: string | null;
          ultimo_login: string | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          avatar_url?: string | null;
          criado_em?: string;
          email: string;
          id: string;
          nome: string;
          senha_alterada?: boolean;
          ultima_senha?: string | null;
          ultimo_login?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          avatar_url?: string | null;
          criado_em?: string;
          email?: string;
          id?: string;
          nome?: string;
          senha_alterada?: boolean;
          ultima_senha?: string | null;
          ultimo_login?: string | null;
        };
        Relationships: [];
      };
      sistemas: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          categoria: string | null;
          criado_em: string;
          criticidade: string;
          descricao: string | null;
          id: string;
          nome: string;
          responsavel_id: string | null;
          url: string | null;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string | null;
          criado_em?: string;
          criticidade?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          responsavel_id?: string | null;
          url?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          categoria?: string | null;
          criado_em?: string;
          criticidade?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          responsavel_id?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sistemas_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          criado_em: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_write: { Args: { _user_id: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      acesso_status: "pendente" | "ativo" | "suspenso" | "exclusao_pendente" | "excluido";
      app_role: "admin_master" | "admin" | "analista" | "supervisor" | "consulta" | "operador";
      colab_status: "ativo" | "ferias" | "afastado" | "inativo" | "desligado";
      pendencia_prioridade: "baixa" | "media" | "alta" | "critica";
      pendencia_status:
        "backlog" | "em_analise" | "em_andamento" | "aguardando" | "concluido" | "cancelado";
      pendencia_tipo: "solicitacao_acesso" | "exclusao_acesso" | "revisao" | "alteracao" | "outro";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      acesso_status: ["pendente", "ativo", "suspenso", "exclusao_pendente", "excluido"],
      app_role: ["admin_master", "admin", "analista", "supervisor", "consulta", "operador"],
      colab_status: ["ativo", "ferias", "afastado", "inativo", "desligado"],
      pendencia_prioridade: ["baixa", "media", "alta", "critica"],
      pendencia_status: [
        "backlog",
        "em_analise",
        "em_andamento",
        "aguardando",
        "concluido",
        "cancelado",
      ],
      pendencia_tipo: ["solicitacao_acesso", "exclusao_acesso", "revisao", "alteracao", "outro"],
    },
  },
} as const;
